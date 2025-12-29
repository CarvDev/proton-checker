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
            
            // Set User-Agent to prevent ProtonDB from blocking requests
            this._session.user_agent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
            
            this._decoder = new TextDecoder('utf-8');

            // Panel icon
            this.add_child(new St.Icon({
                icon_name: 'applications-games-symbolic',
                style_class: 'system-status-icon',
            }));
            
            this._buildMenu();
        }

        _buildMenu() {
            // Search field
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

            // Results section
            this._resultsSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._resultsSection);

            // Connect search event
            searchEntry.clutter_text.connect('activate', () => {
                this._onSearch(searchEntry.get_text());
            });
        }

        async _onSearch(text) {
            this._resultsSection.removeAll();
            
            if (!text || text.trim() === '') return;

            // Loading visual feedback
            const loadingItem = new PopupMenu.PopupMenuItem(_('Searching Steam...'), { reactive: false });
            this._resultsSection.addMenuItem(loadingItem);

            try {
                const games = await this._fetchSteamGames(text);
                
                this._resultsSection.removeAll();

                if (games.length === 0) {
                    this._showStatusMessage(_('No games found.'));
                    return;
                }

                // Populate game list
                games.forEach(game => {
                    const item = new PopupMenu.PopupMenuItem(game.name);
                    item.connect('activate', () => this._onGameSelected(game));
                    this._resultsSection.addMenuItem(item);
                });

            } catch (error) {
                console.error(error);
                this._resultsSection.removeAll();
                this._showStatusMessage(_('Error fetching data.'));
            }
        }

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

        async _onGameSelected(game) {
            this._resultsSection.removeAll();
            
            // Fetching visual feedback
            this._resultsSection.addMenuItem(new PopupMenu.PopupMenuItem(_(`Fetching ProtonDB: ${game.name}...`), { reactive: false }));

            try {
                const protonData = await this._fetchProtonData(game.id);
                this._resultsSection.removeAll();
                this._displayGameDetails(game, protonData);
            } catch (error) {
                console.error(`Fetch Error for ID ${game.id}: ${error}`);
                this._resultsSection.removeAll();
                this._showStatusMessage(_('ProtonDB data not found.'));
            }
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
            // Title
            const titleItem = new PopupMenu.PopupMenuItem(game.name, { reactive: false, style_class: 'game-info-text' });
            titleItem.label.add_style_class_name('header-title'); 
            this._resultsSection.addMenuItem(titleItem);
            this._resultsSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // Tier with specific styling
            const tierClass = data.tier ? `proton-tier-${data.tier.toLowerCase()}` : '';
            this._resultsSection.addMenuItem(
                this._createStyledItem('Tier: ', data.tier ? data.tier.toUpperCase() : 'UNKNOWN', tierClass)
            );

            // Trending status
            const trendingClass = data.trendingTier ? `proton-tier-${data.trendingTier.toLowerCase()}` : '';
            this._resultsSection.addMenuItem(
                this._createStyledItem('Trending: ', data.trendingTier ? data.trendingTier.toUpperCase() : '-', trendingClass)
            );

            // Other details
            this._resultsSection.addMenuItem(this._createStyledItem('Score: ', data.score || '-', null));
            this._resultsSection.addMenuItem(this._createStyledItem('Confidence: ', data.confidence || '-', null));
            this._resultsSection.addMenuItem(this._createStyledItem('Votes: ', data.total || '-', null));
        }

        // Helper to create a "Label: Value" row where value is right-aligned
        _createStyledItem(labelText, valueText, valueStyleClass) {
            let item = new PopupMenu.PopupBaseMenuItem({ reactive: false, style_class:'game-info-text' });
            
            let box = new St.BoxLayout({ x_expand: true });

            // Label (e.g., "Score: ")
            let label = new St.Label({ 
                text: labelText,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Value (e.g., "90")
            let valueLabel = new St.Label({ 
                text: String(valueText),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,             
                x_align: Clutter.ActorAlign.END,
            });

            // Apply specific color class if provided (e.g., for Tier/Trending)
            if (valueStyleClass) {
                valueLabel.add_style_class_name(valueStyleClass);
            }

            box.add_child(label);
            box.add_child(valueLabel);
            item.add_child(box);

            return item;
        }

        _showStatusMessage(message) {
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