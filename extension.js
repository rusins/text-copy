import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const TEXT_BASE = '/tmp/text-copy/text';
const TEXT_PATH  = '/tmp/text-copy/text.txt';

const TextCopyButton = GObject.registerClass(
class TextCopyButton extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Text Copy', true);
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

        const lang = this._settings.get_string('ocr-language') || 'eng';

        if (!Main.screenshotUI) {
            Main.notifyError('Text Copy', 'GNOME Shell screenshot UI unavailable');
            this._busy = false;
            return;
        }

        // Listen for the native screenshot UI signals
        Main.screenshotUI.disconnectObject(this);
        Main.screenshotUI.connectObject(
            'screenshot-taken', (_ui, file) => {
                Main.screenshotUI.disconnectObject(this);
                const imgPath = file?.get_path?.();
                if (imgPath)
                    this._runTesseract(imgPath, lang);
                else
                    this._busy = false;
            },
            'closed', () => {
                Main.screenshotUI.disconnectObject(this);
                this._busy = false;
            },
            this
        );

        // mode 2 = screenshot-only (hides screen-recording option)
        // Falls back to no-arg open() for older shell versions
        try {
            Main.screenshotUI.open(2);
        } catch (_e) {
            try {
                Main.screenshotUI.open();
            } catch (e) {
                Main.screenshotUI.disconnectObject(this);
                Main.notifyError('Text Copy', `Could not open screenshot UI: ${e.message}`);
                this._busy = false;
            }
        }
    }

    _runTesseract(imgPath, lang) {
        GLib.mkdir_with_parents('/tmp/text-copy', 0o755);

        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['tesseract', imgPath, TEXT_BASE, '-l', lang],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE
            );
        } catch (e) {
            Main.notifyError('Text Copy', `Could not start tesseract: ${e.message}`);
            this._cleanup(imgPath);
            return;
        }

        proc.communicate_utf8_async(null, null, (_p, res) => {
            let stderr;
            try {
                [, , stderr] = proc.communicate_utf8_finish(res);
            } catch (e) {
                Main.notifyError('Text Copy', `Tesseract error: ${e.message}`);
                this._cleanup(imgPath);
                return;
            }

            if (!proc.get_successful()) {
                Main.notifyError('Text Copy', `Tesseract failed: ${stderr?.trim() || 'unknown error'}`);
                this._cleanup(imgPath);
                return;
            }

            this._copyToClipboard(imgPath);
        });
    }

    _copyToClipboard(imgPath) {
        let text;
        try {
            const [, contents] = Gio.File.new_for_path(TEXT_PATH).load_contents(null);
            text = new TextDecoder().decode(contents).trim();
        } catch (e) {
            Main.notifyError('Text Copy', `Could not read OCR result: ${e.message}`);
            this._cleanup(imgPath);
            return;
        }

        if (!text) {
            Main.notify('Text Copy', 'No text found in screenshot');
            this._cleanup(imgPath);
            return;
        }

        let proc;
        try {
            proc = Gio.Subprocess.new(['wl-copy'], Gio.SubprocessFlags.STDIN_PIPE);
        } catch (e) {
            Main.notifyError('Text Copy', `Could not start wl-copy: ${e.message}`);
            this._cleanup(imgPath);
            return;
        }

        proc.communicate_utf8_async(text, null, (_p, res) => {
            try {
                proc.communicate_utf8_finish(res);
            } catch (e) {
                Main.notifyError('Text Copy', `wl-copy failed: ${e.message}`);
            }
            this._cleanup(imgPath);
        });
    }

    _cleanup(imgPath) {
        this._busy = false;
        for (const path of [imgPath, TEXT_PATH]) {
            try { Gio.File.new_for_path(path).delete(null); } catch (_e) {}
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
