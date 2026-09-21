import fs from 'fs';
const file = 'c:\\Users\\USER\\Downloads\\user ux\\src\\app\\pages\\AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="flex items-center gap-4">\s*<img\s*src="\/logo\.png"\s*alt="Hope Alive Radio"\s*className="w-9 h-9 rounded-lg object-contain"\s*\/>\s*<h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Admin Dashboard<\/h1>\s*<\/div>/g;

const replacement = `<div className="flex items-center gap-4">
            <img
              src="/tbg-logo.png"
              alt="The Blessed Generation"
              className="w-12 h-10 object-contain"
            />
            <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-600 hidden sm:block"></div>
            <img
              src="/logo.png"
              alt="Hope Alive Radio"
              className="w-9 h-9 rounded-lg object-contain"
            />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Admin Dashboard</h1>
          </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Replaced AdminDashboard header logo successfully.');
