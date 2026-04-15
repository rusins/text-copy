import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const TMP_DIR = '/tmp/text-copy';
const SCREENSHOT_PATH = '/tmp/text-copy/ocr.png';
const TEXT_BASE = '/tmp/text-copy/text';      // tesseract appends .txt
const TEXT_PATH = '/tmp/text-copy/text.txt';

const TextCopyButton = GObject.registerClass(
class TextCopyButton extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Text Copy', true); // dontCreateMenu = true
        this._settings = settings;
        this._busy = false;

        this.add_child(new St.Icon({
            icon_name: 'insert-text-symbolic',
            style_class: 'system-status-icon',
        }));

        this.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === Clutter.BUTTON_PRIMARY)
                this._capture();
            return Clutter.EVENT_STOP;
        });
    }

    _capture() {
        if (this._busy) return;
        this._busy = true;

        GLib.mkdir_with_parents(TMP_DIR, 0o755);

        const lang = this._settings.get_string('ocr-language') || 'eng';

        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['gnome-screenshot', '--area', `--file=${SCREENSHOT_PATH}`],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
            );
        } catch (e) {
            Main.notifyError('Text Copy', `Could not start gnome-screenshot: ${e.message}`);
            this._busy = false;
            return;
        }

        proc.wait_async(null, (_p, res) => {
            try {
                proc.wait_finish(res);
            } catch (e) {
                console.error('Text Copy:', e);
                this._busy = false;
                return;
            }

            // If the file doesn't exist the user cancelled — just reset quietly
            if (!Gio.File.new_for_path(SCREENSHOT_PATH).query_exists(null)) {
                this._busy = false;
                return;
            }

            this._runTesseract(lang);
        });
    }

    _runTesseract(lang) {
        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['tesseract', SCREENSHOT_PATH, TEXT_BASE, '-l', lang],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            Main.notifyError('Text Copy', `Could not start tesseract: ${e.message}`);
            this._cleanup();
            return;
        }

        proc.communicate_utf8_async(null, null, (_p, res) => {
            let stderr;
            try {
                [, , stderr] = proc.communicate_utf8_finish(res);
            } catch (e) {
                Main.notifyError('Text Copy', `Tesseract error: ${e.message}`);
                this._cleanup();
                return;
            }

            if (!proc.get_successful()) {
                Main.notifyError('Text Copy', `Tesseract failed: ${stderr?.trim() || 'unknown error'}`);
                this._cleanup();
                return;
            }

            this._copyToClipboard();
        });
    }

    _copyToClipboard() {
        let text;
        try {
            const [, contents] = Gio.File.new_for_path(TEXT_PATH).load_contents(null);
            text = new TextDecoder().decode(contents).trim();
        } catch (e) {
            Main.notifyError('Text Copy', `Could not read OCR result: ${e.message}`);
            this._cleanup();
            return;
        }

        if (!text) {
            Main.notify('Text Copy', 'No text found in screenshot');
            this._cleanup();
            return;
        }

        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['wl-copy'],
                Gio.SubprocessFlags.STDIN_PIPE
            );
        } catch (e) {
            Main.notifyError('Text Copy', `Could not start wl-copy: ${e.message}`);
            this._cleanup();
            return;
        }

        proc.communicate_utf8_async(text, null, (_p, res) => {
            try {
                proc.communicate_utf8_finish(res);
                Main.notify('Text Copy', 'Text copied to clipboard!');
            } catch (e) {
                Main.notifyError('Text Copy', `wl-copy failed: ${e.message}`);
            }
            this._cleanup();
        });
    }

    _cleanup() {
        this._busy = false;
        for (const path of [SCREENSHOT_PATH, TEXT_PATH]) {
            try {
                Gio.File.new_for_path(path).delete(null);
            } catch (_e) { /* ignore if already gone */ }
        }
    }
});

export default class TextCopyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._button = new TextCopyButton(this._settings);
        Main.panel.addToStatusArea(this.uuid, this._button);
    }

    disable() {
        this._button?.destroy();
        this._button = null;
        this._settings = null;
    }
}
