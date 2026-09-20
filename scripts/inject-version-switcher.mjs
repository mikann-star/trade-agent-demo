import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const targetDirectory = process.argv[2];
const scriptSource = process.argv[3];
const versionedScriptSource = `${scriptSource}?v=2.10.0`;

if (!targetDirectory || !scriptSource) {
  throw new Error(
    "Usage: node scripts/inject-version-switcher.mjs <target-directory> <script-src>",
  );
}

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectHtmlFiles(path);
      return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
    }),
  );
  return nested.flat();
}

await cp("public/version-switcher.js", join(targetDirectory, "version-switcher.js"));

for (const htmlFile of await collectHtmlFiles(targetDirectory)) {
  const html = await readFile(htmlFile, "utf8");
  const existingScriptPattern =
    /<script\s+src="[^"]*\/version-switcher\.js(?:\?[^\"]*)?"\s+defer(?:="")?><\/script>/;
  const versionSwitcherScript = `<script src="${versionedScriptSource}" defer></script>`;
  await writeFile(
    htmlFile,
    existingScriptPattern.test(html)
      ? html.replace(existingScriptPattern, versionSwitcherScript)
      : html.replace("</body>", `${versionSwitcherScript}</body>`),
  );
}
