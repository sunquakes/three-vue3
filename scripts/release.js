#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Get version from command line argument or prompt
const version = process.argv[2]

if (!version) {
  console.error('Please provide a version number:')
  console.error('  npm run release 0.0.7')
  console.error('Or use predefined scripts:')
  console.error('  npm run release:patch  # Bump patch version')
  console.error('  npm run release:minor  # Bump minor version')
  console.error('  npm run release:major  # Bump major version')
  process.exit(1)
}

// Validate version format
const versionRegex = /^\d+\.\d+\.\d+$/
if (!versionRegex.test(version)) {
  console.error('Invalid version format. Please use semantic versioning (e.g., 0.0.7)')
  process.exit(1)
}

console.log(`🚀 Releasing version ${version}...`)

// Update package.json version
const packageJsonPath = path.join(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
const oldVersion = packageJson.version

console.log(`📦 Updating version from ${oldVersion} to ${version}...`)
packageJson.version = version
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

// Update CHANGELOG.md if exists
const changelogPath = path.join(rootDir, 'CHANGELOG.md')
if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, 'utf-8')
  const today = new Date().toISOString().split('T')[0]
  
  // Check if version already exists in changelog
  if (!changelog.includes(`## [${version}]`)) {
    console.log('📝 Updating CHANGELOG.md...')
    const newChangelog = `## [${version}] - ${today}\n\n### Added\n\n- Release version ${version}\n\n---\n\n${changelog}`
    fs.writeFileSync(changelogPath, newChangelog)
  }
}

// Commit changes
console.log('💾 Committing changes...')
try {
  execSync(`git add ${packageJsonPath}`, { stdio: 'inherit' })
  if (fs.existsSync(changelogPath)) {
    execSync(`git add ${changelogPath}`, { stdio: 'inherit' })
  }
  execSync(`git commit -m "chore: release version ${version}"`, { stdio: 'inherit' })
} catch (error) {
  console.log('⚠️  No changes to commit or commit failed')
}

// Create tag
console.log('🏷️  Creating git tag...')
try {
  execSync(`git tag ${version}`, { stdio: 'inherit' })
  console.log(`✅ Successfully created tag ${version}`)
} catch (error) {
  console.error(`❌ Failed to create tag ${version}. Tag might already exist.`)
  process.exit(1)
}

console.log('\n✨ Release preparation complete!')
console.log('📤 To push the release, run:')
console.log(`   git push origin --tags`)
console.log('\n🌐 GitHub Actions will automatically build and publish to NPM')
