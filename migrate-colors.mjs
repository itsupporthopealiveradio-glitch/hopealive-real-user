import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src/app', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Remove all 'dark:' classes for bg, text, border
    content = content.replace(/dark:bg-[a-zA-Z0-9-\[\]#\/]+/g, '');
    content = content.replace(/dark:text-[a-zA-Z0-9-\[\]#\/]+/g, '');
    content = content.replace(/dark:border-[a-zA-Z0-9-\[\]#\/]+/g, '');
    
    // 2. Replace background colors
    content = content.replace(/\bbg-white\b/g, 'bg-surface');
    content = content.replace(/\bbg-black\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-\[\#0f0f0f\]\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-\[\#1a1a1a\]\b/g, 'bg-surface');
    content = content.replace(/\bbg-slate-50\b/g, 'bg-surface');
    content = content.replace(/\bbg-gray-50\b/g, 'bg-surface');
    content = content.replace(/\bbg-slate-100\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-gray-100\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-slate-800\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-slate-900\b/g, 'bg-surface-elevated');
    content = content.replace(/\bbg-slate-950\b/g, 'bg-surface-elevated');
    
    // 3. Replace text colors
    content = content.replace(/\btext-slate-900\b/g, 'text-content');
    content = content.replace(/\btext-gray-900\b/g, 'text-content');
    content = content.replace(/\btext-black\b/g, 'text-content');
    content = content.replace(/\btext-slate-800\b/g, 'text-content');
    content = content.replace(/\btext-slate-500\b/g, 'text-content-muted');
    content = content.replace(/\btext-gray-500\b/g, 'text-content-muted');
    content = content.replace(/\btext-slate-600\b/g, 'text-content-muted');
    content = content.replace(/\btext-slate-400\b/g, 'text-content-subtle');
    content = content.replace(/\btext-gray-400\b/g, 'text-content-subtle');
    
    // Only replace text-white if it doesn't look like it belongs to a colored button/badge
    // We can do this by using regex that ensures bg-blue-500 or bg-red-500 etc is NOT in the same class string.
    // A simpler way: we just replace it, and then fix known button classes.
    content = content.replace(/\btext-white\b/g, 'text-content');
    // Fix buttons that had bg-blue-500 or bg-red-500 or bg-green-500
    content = content.replace(/bg-blue-500(\s+[a-zA-Z0-9-\/:]+)*\s+text-content/g, match => match.replace('text-content', 'text-white'));
    content = content.replace(/bg-red-500(\s+[a-zA-Z0-9-\/:]+)*\s+text-content/g, match => match.replace('text-content', 'text-white'));
    content = content.replace(/bg-green-500(\s+[a-zA-Z0-9-\/:]+)*\s+text-content/g, match => match.replace('text-content', 'text-white'));
    content = content.replace(/bg-\[\#FEAC22\](\s+[a-zA-Z0-9-\/:]+)*\s+text-content/g, match => match.replace('text-content', 'text-white'));
    content = content.replace(/bg-gradient-to-[a-z]+(\s+[a-zA-Z0-9-\/:]+)*\s+text-content/g, match => match.replace('text-content', 'text-white'));
    
    // 4. Replace borders
    content = content.replace(/\bborder-slate-200\b/g, 'border-border-strong');
    content = content.replace(/\bborder-gray-200\b/g, 'border-border-strong');
    content = content.replace(/\bborder-slate-800\b/g, 'border-border-strong');
    content = content.replace(/\bborder-white\/10\b/g, 'border-border-strong');
    content = content.replace(/\bborder-white\/20\b/g, 'border-border-strong');

    // Fix up extra spaces left by dark: removals
    content = content.replace(/\s{2,}/g, ' ');

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', filePath);
    }
  }
});
