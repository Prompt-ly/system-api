import type { Setting, SettingRegistry } from "@/modules/settings";
import { spawn } from "node:child_process";

function launchSetting(id: string): void {
  spawn(`ms-settings:${id}`, [], { detached: true, stdio: "ignore" });
}

export class WindowsSettingRegistry implements SettingRegistry {
  getSettings(): Setting[] {
    function setting(id: string, name: string): Setting {
      return { id: `ms-settings:${id}`, name, open: () => launchSetting(id) };
    }

    const settings: Setting[] = [
      // Accounts
      setting("workplace", "Access work or school"),
      setting("emailandaccounts", "Email & accounts"),
      setting("otherusers", "Other users"),
      setting("signinoptions", "Sign-in options"),
      setting("backup", "Windows Backup"),
      setting("yourinfo", "Your info"),
      setting("family-group", "Family"),

      // Apps
      setting("appsfeatures", "Apps & features"),
      setting("appsforwebsites", "Apps for websites"),
      setting("defaultapps", "Default apps"),
      setting("optionalfeatures", "Optional features"),
      setting("maps", "Offline maps"),
      setting("startupapps", "Startup apps"),
      setting("videoplayback", "Video playback"),

      // Devices
      setting("autoplay", "AutoPlay"),
      setting("devices", "Bluetooth & devices"),
      setting("connecteddevices", "Devices"),
      setting("camera", "Camera"),
      setting("mousetouchpad", "Mouse"),
      setting("pen", "Pen & Windows Ink"),
      setting("printers", "Printers & scanners"),
      setting("devices-touchpad", "Touchpad"),
      setting("typing", "Typing"),
      setting("usb", "USB"),

      // Ease of Access
      setting("easeofaccess-audio", "Audio"),
      setting("easeofaccess-closedcaptioning", "Captions"),
      setting("easeofaccess-colorfilter", "Color filters"),
      setting("easeofaccess-eyecontrol", "Eye control"),
      setting("easeofaccess-hearingaids", "Hearing devices"),
      setting("easeofaccess-highcontrast", "Contrast themes"),
      setting("easeofaccess-keyboard", "Keyboard"),
      setting("easeofaccess-magnifier", "Magnifier"),
      setting("easeofaccess-mousepointer", "Mouse pointer and touch"),
      setting("easeofaccess-narrator", "Narrator"),
      setting("easeofaccess-speechrecognition", "Speech"),
      setting("easeofaccess-cursor", "Text cursor"),
      setting("easeofaccess-visualeffects", "Visual Effects"),

      // Gaming
      setting("gaming-gamedvr", "Captures"),
      setting("gaming-gamebar", "Game Bar"),
      setting("gaming-gamemode", "Game Mode"),

      // Network & Internet
      setting("network-status", "Network & internet"),
      setting("network-advancedsettings", "Advanced network settings"),
      setting("network-airplanemode", "Airplane mode"),
      setting("network-dialup", "Dial-up"),
      setting("network-ethernet", "Ethernet"),
      setting("network-mobilehotspot", "Mobile hotspot"),
      setting("network-proxy", "Proxy"),
      setting("network-vpn", "VPN"),
      setting("network-wifi", "Wi-Fi"),

      // Personalization
      setting("personalization-background", "Background"),
      setting("personalization-colors", "Colors"),
      setting("personalization-lighting", "Dynamic Lighting"),
      setting("fonts", "Fonts"),
      setting("lockscreen", "Lock screen"),
      setting("personalization", "Personalization"),
      setting("personalization-start", "Start"),
      setting("taskbar", "Taskbar"),
      setting("personalization-textinput", "Text input"),
      setting("themes", "Themes"),

      // Privacy
      setting("privacy-accountinfo", "Account info"),
      setting("privacy-activityhistory", "Activity history"),
      setting("privacy-appdiagnostics", "App diagnostics"),
      setting("privacy-automaticfiledownloads", "Automatic file downloads"),
      setting("privacy-calendar", "Calendar"),
      setting("privacy-callhistory", "Call history"),
      setting("privacy-contacts", "Contacts"),
      setting("privacy-documents", "Documents"),
      setting("privacy-downloadsfolder", "Downloads folder"),
      setting("privacy-email", "Email"),
      setting("privacy-broadfilesystemaccess", "File system"),
      setting("privacy", "Privacy & security"),
      setting("privacy-general", "Recommendations & offers"),
      setting("privacy-speechtyping", "Inking & typing personalization"),
      setting("privacy-location", "Location"),
      setting("privacy-messaging", "Messaging"),
      setting("privacy-microphone", "Microphone"),
      setting("privacy-musiclibrary", "Music Library"),
      setting("privacy-customdevices", "Other devices"),
      setting("privacy-phonecalls", "Phone calls"),
      setting("privacy-pictures", "Pictures"),
      setting("privacy-radios", "Radios"),
      setting("privacy-tasks", "Tasks"),
      setting("privacy-videos", "Videos"),
      setting("privacy-voiceactivation", "Voice activation"),

      // Sound
      setting("apps-volume", "Volume mixer"),
      setting("sound", "Sound"),
      setting("sound-devices", "Sound devices"),

      // System
      setting("search", "Search"),
      setting("about", "About"),
      setting("powersleep", "Power & battery"),
      setting("clipboard", "Clipboard"),
      setting("display", "Display"),
      setting("deviceencryption", "Device encryption"),
      setting("quiethours", "Focus"),
      setting("multitasking", "Multitasking"),
      setting("nightlight", "Night light"),
      setting("project", "Projecting to this PC"),
      setting("taskbar", "Taskbar"),
      setting("notifications", "Notifications"),
      setting("remotedesktop", "Remote Desktop"),
      setting("storagesense", "Storage"),

      // Time & Language
      setting("dateandtime", "Date & time"),
      setting("regionlanguage", "Language & region"),

      // Update & Security
      setting("activation", "Activation"),
      setting("findmydevice", "Find my device"),
      setting("developers", "For developers"),
      setting("recovery", "Recovery"),
      setting("troubleshoot", "Troubleshoot"),
      setting("windowsdefender", "Windows Security"),
      setting("windowsinsider", "Windows Insider Program"),
      setting("windowsupdate", "Windows Update")
    ];

    return settings;
  }
}
