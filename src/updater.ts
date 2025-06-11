import path from 'path';
import fs from 'fs'; // Using the promise-based version is often better with async/await

// 2. Import third-party libraries
import simpleGit, { type SimpleGit, ResetMode, CleanOptions } from 'simple-git';

import 'dotenv/config';

const localPath = findPath(['.git'], true);
const clonedFilePath = path.join(localPath, 'cloned.info');

function findPath(pathName: string[], root: boolean = false): string {
	for (let element of pathName) {
		for (let i = 0; i < 10; i++) {
			const f = path.resolve('../'.repeat(i));
			const p = path.resolve(f, element);

			if (fs.existsSync(p)) {
				return root ? f : p;
			}
		}
	}

	throw new Error('Mi tia tiene problemas y no encontro el path recursivo');
}

let git: SimpleGit;

if (!fs.existsSync(localPath)) {
	git = simpleGit();
} else git = simpleGit(localPath);

const version = '1.1.2';

const repoUrl: string = process.env.GIT_REPO_URL as string;

const files = [
	path.join(localPath, '.git/refs/heads/main.lock'),
	path.join(localPath, '.git/HEAD.lock')
];

files.forEach((file) => {
	if (fs.existsSync(file)) fs.unlinkSync(file);
});

/*const filesToRetrieve = [
	'updater.ts',
	'.replit',
	'README.md',
	'LICENSE',
	'tsconfig.json',
	'package-lock.json',
	'package.json',
	'.env'
];

async function retrieveFiles() {
	for (const file of filesToRetrieve) {
		const oldPath = path.join(localPath, file);
		const newPath = path.join(path.resolve(), file);

		if (!fs.existsSync(oldPath)) continue;

		console.log('Copying ' + oldPath + ' to ' + newPath);

		fs.copyFile(oldPath, newPath, (err: any) => {
			if (err) console.error(`Error moving file: ${err.message}`);
			else if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
		});
	}
}*/

async function cloneRepo() {
	const results = await git.clone(repoUrl, localPath).catch((err: any) => {
		console.error('Failed to clone:', err);
	});

	if (results) {
		console.log(`Repo cloned to ${localPath}`);

		fs.writeFileSync(clonedFilePath, 'Repo has been cloned.');

		await purgeCache();

		//await retrieveFiles();

		exit();
	}
}

const minifiedDir = path.resolve(__dirname, '..', 'minified');

async function pullUpdates() {
	try {
		const update = await git.pull();

		global.headHash = await git.revparse('HEAD');

		if (update?.summary?.changes) {
			console.log(`Updated from github`);
			console.log(update);

			await purgeCache();

			const startPath = 'src/content/';

			update.files
				.filter((element: string) => element.startsWith(startPath))
				.forEach((element: string) => {
					let relativePath = element.replace(startPath, '');
					console.log('Checking minified path: ' + relativePath);

					const targetPath = path.join(minifiedDir, relativePath);

					if (fs.existsSync(targetPath)) {
						console.log('Removing cached path: ' + targetPath);
						fs.unlinkSync(targetPath);
					}
				});

			//await retrieveFiles();

			if (
				update.files.some((fileName: any) => fileName.endsWith('.ts'))
			) {
				console.log('Code files updated restarting server...');
				exit();
			}
		}
	} catch (err) {
		console.error('Failed to pull updates:', err);

		await git.reset(ResetMode.HARD);
		await git.clean(CleanOptions.FORCE);
	}
}

async function purgeCache() {
	try {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE}/purge_cache`,
			{
				method: 'POST',

				headers: {
					'Authorization': 'Bearer ' + process.env.CF_CACHE_TOKEN,
					'Content-Type': 'application/json'
				},

				body: JSON.stringify({
					purge_everything: true
				})
			}
		);

		const data = await response.json();

		console.log(data);
	} catch (error) {
		console.error(error);
	}
}

function exit() {
	process.exit(0);

	exit();
}

async function start() {
	if (!fs.existsSync(localPath)) {
		console.log('Repo not found, cloning...');
		cloneRepo();
	} else {
		console.log('Repo already exists, pulling updates... VER:' + version);

		await pullUpdates();
	}

	//await UpdatePackages();

	setInterval(pullUpdates, 5 * 60 * 1000); //Pull updates evey 5 minutes

	require(findPath(['src/index.ts', 'src/main.ts'], false));
}

export default start;
export { cloneRepo, pullUpdates, purgeCache, exit };
