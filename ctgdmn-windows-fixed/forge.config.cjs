const path = require('path');
const fs = require('fs');
const electronZipDir = process.env.CTGDMN_ELECTRON_ZIP_DIR;

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: 'CTGDMN',
    icon: path.join(__dirname, 'assets', 'icon'),
    ...(electronZipDir ? { electronZipDir: path.resolve(electronZipDir) } : {}),
    extraResource: [
      path.join(__dirname, 'program-documents'),
      path.join(__dirname, 'guides'),
    ],
    ignore: [
      /^\/tests($|\/)/,
      /^\/program-documents($|\/)/,
      /^\/guides($|\/)/,
      /^\/README\.md$/,
      /^\/AGENTS\.md$/,
      /^\/out\.rar$/,
      /^\/qa-/,
    ],
  },
  hooks: {
    postPackage: async (_forgeConfig, packageResult) => {
      const retainedLocales = new Set(['en-US.pak', 'vi.pak']);
      for (const outputPath of packageResult.outputPaths) {
        const localesPath = path.join(outputPath, 'locales');
        if (!fs.existsSync(localesPath)) continue;
        for (const entry of fs.readdirSync(localesPath, { withFileTypes: true })) {
          if (entry.isFile() && !retainedLocales.has(entry.name)) {
            fs.rmSync(path.join(localesPath, entry.name), { force: true });
          }
        }
      }
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'CTGDMN',
        authors: 'Nguyễn Thị Thu Hiền',
        description: 'Ứng dụng quản lý chương trình giáo dục mầm non CTGDMN',
        setupExe: 'CTGDMN-Setup.exe',
        setupIcon: path.join(__dirname, 'assets', 'icon.ico'),
        // Squirrel keeps userData (SQLite, plans and settings) outside the
        // install directory, so updates/uninstalls do not remove user data.
        noMsi: true,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};
