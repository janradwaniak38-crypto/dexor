import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repository = process.env.GITHUB_REPOSITORY || 'OWNER/REPOSITORY';
const [owner, repo] = repository.split('/');
if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must use owner/repository format.');

const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
const siteRoot = isUserSite ? `https://${owner}.github.io/` : `https://${owner}.github.io/${repo}/`;
const siteConfig = {
  repository,
  appName: 'Dexor',
  latestInstaller: `https://github.com/${repository}/releases/latest/download/Dexor-Setup.exe`
};
const desktopConfig = { catalogUrl: new URL('catalog.json', siteRoot).toString() };

fs.writeFileSync(path.join(root, 'public', 'config.json'), `${JSON.stringify(siteConfig, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'desktop', 'config.json'), `${JSON.stringify(desktopConfig, null, 2)}\n`);
console.log(`Prepared Dexor config for ${repository} at ${siteRoot}`);
