const { spawn, exec } = require('child_process');
const path = require('path');

const apps = [
  { name: 'Backend', dir: '.', command: 'npm', args: ['run', 'dev'] },
  { name: 'Business Admin', dir: 'admin-app', command: 'npm', args: ['run', 'dev'] },
  { name: 'Chatbot Admin', dir: 'chatbot-admin-app', command: 'npm', args: ['run', 'dev'] },
  { name: 'Reseller App', dir: 'reseller-app', command: 'npm', args: ['run', 'dev'] },
  { name: 'Super Admin', dir: 'total-admin-app', command: 'npm', args: ['run', 'dev'] }
];

const children = [];

console.log('🚀 Starting all SaaS platform applications (Backend & 4 Frontends)...');

apps.forEach(app => {
  const runPath = path.resolve(__dirname, app.dir);
  console.log(`[System] Launching ${app.name} in ${app.dir}...`);

  // On Windows, use shell: true to avoid spawn EINVAL/ENOENT errors under Node 22+
  const child = spawn('npm', ['run', 'dev'], {
    cwd: runPath,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  child.stdout.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`[${app.name}] ${line}`);
      }
    });
  });

  child.stderr.on('data', data => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.error(`[${app.name} ERROR] ${line}`);
      }
    });
  });

  child.on('close', code => {
    console.log(`[System] ${app.name} exited with code ${code}`);
  });

  children.push(child);
});

// Handle termination signals to kill all child processes
const cleanup = () => {
  console.log('\n[System] Stopping all running processes...');
  children.forEach(child => {
    if (child && !child.killed) {
      if (process.platform === 'win32') {
        // Force kill the process tree on Windows
        exec(`taskkill /pid ${child.pid} /t /f`, () => {});
      } else {
        child.kill('SIGINT');
      }
    }
  });
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
