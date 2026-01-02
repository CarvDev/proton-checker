/* extension.js
 *
 * Copyright (C) 2025 CarvDev
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const ProtonCheckerIndicator = GObject.registerClass(
    class ProtonCheckerIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('ProtonDB Checker Indicator'));

            // Initialize HTTP session (Soup 3)
            this._session = new Soup.Session();
            // User-Agent required to prevent ProtonDB from blocking requests
            this._session.user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
            
            this._decoder = new TextDecoder('utf-8');

            this.add_child(new St.Icon({
                icon_name: 'applications-games-symbolic',
                style_class: 'system-status-icon',
            }));
            
            this._buildMenu();

            // Ensure proper cleanup. We connect to the destroy signal to handle
            // the session disposal within the class scope, preventing issues 
            // in the extension's disable() method.
            this.connect('destroy', () => {
                if (this._session) {
                    this._session.abort();
                    this._session = null;
                }
            });
        }

        _buildMenu() {
            const searchEntry = new St.Entry({
                style_class: 'search-entry',
                hint_text: _('Search game...'),
                track_hover: false,
                can_focus: true,
                x_expand: true,
            });

            const searchBox = new PopupMenu.PopupBaseMenuItem({
                activate: false,
                can_focus: false,
            });
            searchBox.add_child(searchEntry);
            this.menu.addMenuItem(searchBox);

            this._resultsSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._resultsSection);

            searchEntry.clutter_text.connect('activate', () => {
                this._onSearch(searchEntry.get_text());
            });
        }

        // ============================================================
        // UI Management Helpers (Memory Safety)
        // ============================================================

        /**
         * Soft Clear: Visually hides items without destroying them from memory.
         * * This workaround prevents "Object St_Bin has been already disposed" errors
         * caused by race conditions when the menu is closing while items are being modified.
         */
        _softClear() {
            if (!this._resultsSection) return;

            const items = this._resultsSection._getMenuItems();
            items.forEach(item => {
                if (item.actor) item.actor.visible = false;
            });
        }

        /**
         * Hard Clear: Actually removes items from the container.
         * * Only call this when sure the menu is stable (e.g., start of new search)
         * or after confirming the actor is still mapped.
         */
        _hardClear() {
            if (!this._resultsSection) return;
            this._resultsSection.removeAll();
        }        

        // ============================================================
        // Main Logic
        // ============================================================

        async _onSearch(text) {
            if (!this._resultsSection) return;
            
            // Safe to hard clear here as this is triggered by user input (menu is open/stable)
            this._hardClear();
            
            if (!text || text.trim() === '') return;

            const loadingItem = new PopupMenu.PopupMenuItem(_('Searching Steam...'), { reactive: false });
            this._resultsSection.addMenuItem(loadingItem);

            try {
                const games = await this._fetchSteamGames(text);

                // Safety check: If the menu was closed during the async fetch,
                // stop execution to avoid accessing disposed objects.
                if (!this._resultsSection || !this._resultsSection.actor.mapped) {
                    return; 
                }
                
                this._hardClear();

                if (games.length === 0) {
                    this._showStatusMessage(_('No games found.'));
                    return;
                }

                games.forEach(game => {
                    const item = new PopupMenu.PopupBaseMenuItem();
                    
                    const label = new St.Label({ 
                        text: game.name,
                        y_align: Clutter.ActorAlign.CENTER 
                    });
                    item.add_child(label);
                    
                    // Override 'activate' to prevent the menu from closing automatically on click.
                    // We handle the navigation logic manually.
                    item.activate = (event) => {
                        if (this._resultsSection) {
                            this._onGameSelected(game);
                        }
                    };
                    
                    this._resultsSection.addMenuItem(item);
                });

            } catch (error) {
                console.error(`[ProtonDB Checker] Error: ${error}`);
                if (this._resultsSection && this._resultsSection.actor.mapped) {
                    this._hardClear();
                    this._showStatusMessage(_('Error fetching data.'));
                }
            }
        }

        async _onGameSelected(game) {
            if (!this._resultsSection) return;
            
            // 1. Soft Clear: Hide items immediately to prevent crash if user clicks outside
            this._softClear();

            // 2. Add visual feedback (only visible item)
            const fetchingItem = new PopupMenu.PopupMenuItem(_('Fetching ProtonDB: %s...').format(game.name), { 
                reactive: false 
            });
            this._resultsSection.addMenuItem(fetchingItem);

            try {
                const protonData = await this._fetchProtonData(game.id);
                
                // Safety check: Ensure menu is still drawn on screen
                if (!this._resultsSection || !this._resultsSection.actor.mapped) return;

                // 3. Hard Clear: Now that data is ready and menu is stable, clean up memory
                this._hardClear();
                
                this._displayGameDetails(game, protonData);
                
            } catch (error) {
                console.error(`[ProtonDB Checker] Error: ${error}`);
                if (this._resultsSection && this._resultsSection.actor.mapped) {
                    this._hardClear();
                    this._showStatusMessage(_('ProtonDB data not found.'));
                }
            }
        }

        // ============================================================
        // API & Rendering
        // ============================================================

        async _fetchSteamGames(searchText) {
            const steamEndpoint = "https://store.steampowered.com/api/storesearch/";
            const term = encodeURIComponent(searchText);
            const url = `${steamEndpoint}?term=${term}&l=english&cc=US`;

            const message = Soup.Message.new('GET', url);
            const bytes = await this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

            if (message.status_code !== 200) {
                throw new Error(`Steam API Error: ${message.status_code}`);
            }

            const data = JSON.parse(this._decoder.decode(bytes.get_data()));
            return data.items || [];
        }

        async _fetchProtonData(gameId) {
            const protonEndpoint = `https://www.protondb.com/api/v1/reports/summaries/${gameId}.json`;
            
            const message = Soup.Message.new('GET', protonEndpoint);
            const bytes = await this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

            if (message.status_code !== 200) {
                throw new Error(`ProtonDB API Error: ${message.status_code} ${message.reason_phrase}`);
            }

            return JSON.parse(this._decoder.decode(bytes.get_data()));
        }

        _displayGameDetails(game, data) {
            if (!this._resultsSection) return;

            const titleItem = new PopupMenu.PopupBaseMenuItem({ 
                reactive: false, 
                style_class: 'game-info-text' 
            });
            
            const titleBox = new St.BoxLayout({ x_expand: true });
            
            const titleLabel = new St.Label({
                text: game.name,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'header-title'
            });
            titleBox.add_child(titleLabel);
            
            // Link icon to open ProtonDB page
            const linkButton = new St.Button({
                style_class: 'protondb-link-button',
                child: new St.Icon({
                    icon_name: 'web-browser-symbolic',
                    icon_size: 16,
                }),
                y_align: Clutter.ActorAlign.CENTER,
            });
            
            linkButton.connect('clicked', () => {
                const protonUrl = `https://www.protondb.com/app/${game.id}`;
                Gio.AppInfo.launch_default_for_uri(protonUrl, null);
            });
            
            titleBox.add_child(linkButton);
            titleItem.add_child(titleBox);
            
            this._resultsSection.addMenuItem(titleItem);
            this._resultsSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const tierClass = data.tier ? `proton-tier-${data.tier.toLowerCase()}` : '';
            this._resultsSection.addMenuItem(
                this._createStyledItem('Tier: ', data.tier ? data.tier.toUpperCase() : 'UNKNOWN', tierClass)
            );

            const trendingClass = data.trendingTier ? `proton-tier-${data.trendingTier.toLowerCase()}` : '';
            this._resultsSection.addMenuItem(
                this._createStyledItem('Trending: ', data.trendingTier ? data.trendingTier.toUpperCase() : '-', trendingClass)
            );

            this._resultsSection.addMenuItem(this._createStyledItem('Score: ', data.score || '-', null));
            this._resultsSection.addMenuItem(this._createStyledItem('Confidence: ', data.confidence || '-', null));
            this._resultsSection.addMenuItem(this._createStyledItem('Votes: ', data.total || '-', null));
        }

        _createStyledItem(labelText, valueText, valueStyleClass) {
            let item = new PopupMenu.PopupBaseMenuItem({ 
                reactive: false, 
                style_class:'game-info-text' 
            });
            
            let box = new St.BoxLayout({ x_expand: true });

            let label = new St.Label({ 
                text: labelText,
                y_align: Clutter.ActorAlign.CENTER,
            });

            let valueLabel = new St.Label({ 
                text: String(valueText),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,             
                x_align: Clutter.ActorAlign.END,
            });

            if (valueStyleClass) {
                valueLabel.add_style_class_name(valueStyleClass);
            }

            box.add_child(label);
            box.add_child(valueLabel);
            item.add_child(box);

            return item;
        }

        _showStatusMessage(message) {
            if (!this._resultsSection) return;
            const item = new PopupMenu.PopupMenuItem(message, { reactive: false });
            this._resultsSection.addMenuItem(item);
        }
    }
);

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new ProtonCheckerIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}