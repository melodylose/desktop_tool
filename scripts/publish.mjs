import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Octokit } from '@octokit/rest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 讀取 CHANGELOG.md
function getLatestChangelog() {
    const changelog = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
    const version = getVersion();
    
    // 將文件內容按版本分割
    const sections = changelog.split(/(?=## \[\d+\.\d+\.\d+\])/);
    
    // 找到當前版本的部分
    const currentVersionSection = sections.find(section => section.startsWith(`## [${version}]`));
    
    if (currentVersionSection) {
        // 移除末尾的多餘空行
        return currentVersionSection.trim();
    }
    return '';
}

// 從 package.json 讀取版本號
function getVersion() {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    return packageJson.version;
}

async function updateGitHubRelease(version, changelog) {
    const octokit = new Octokit({
        auth: process.env.GH_TOKEN
    });

    try {
        // 等待一段時間，確保 electron-builder 已經創建了 release
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 獲取所有 releases
        const { data: releases } = await octokit.repos.listReleases({
            owner: 'melodylose',
            repo: 'desktop_tool'
        });

        // 找到對應版本的 release
        const release = releases.find(r => r.tag_name === `v${version}`);
        
        if (!release) {
            throw new Error(`Release for version ${version} not found`);
        }

        // 更新 release 的描述
        await octokit.repos.updateRelease({
            owner: 'melodylose',
            repo: 'desktop_tool',
            release_id: release.id,
            body: changelog
        });

        console.log('Successfully updated release notes');
    } catch (error) {
        console.error('Error updating release notes:', error);
    }
}

async function publish() {
    try {
        const version = getVersion();
        const changelog = getLatestChangelog();
        
        // 執行發布命令
        console.log('Publishing version', version);
        console.log('Changelog:', changelog);
        
        execSync('electron-builder build -p always', {
            stdio: 'inherit'
        });

        // 更新 GitHub Release 描述
        await updateGitHubRelease(version, changelog);

        console.log('Published successfully!');
    } catch (error) {
        console.error('Error during publish:', error);
        process.exit(1);
    }
}

publish();
