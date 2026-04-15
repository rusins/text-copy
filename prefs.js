import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TextCopyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Settings',
            iconName: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({ title: 'OCR Settings' });
        page.add(group);

        const langRow = new Adw.EntryRow({
            title: 'OCR Language',
            text: settings.get_string('ocr-language'),
        });
        langRow.set_tooltip_text('Tesseract language code, e.g. eng, deu, fra, rus. Run "tesseract --list-langs" to see installed languages.');
        group.add(langRow);

        langRow.connect('changed', () => {
            const val = langRow.text.trim();
            if (val)
                settings.set_string('ocr-language', val);
        });
    }
}
