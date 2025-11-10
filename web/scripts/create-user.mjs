#!/usr/bin/env node
import readline from 'node:readline';
import { stdin, stdout, stderr, exit } from 'node:process';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ROLE_VALUES = new Set(['user', 'manager', 'admin']);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function question(query, { silent = false } = {}) {
  const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
  if (silent) {
    rl.stdoutMuted = true;
    rl._writeToOutput = function write(str) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        rl.output.write(str);
      }
    };
  }

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.stdoutMuted = false;
      rl.output.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceKey) {
    stderr.write('Missing SUPABASE_URL and/or service-role key environment variables.\n');
    exit(1);
  }

  const email =
    args.email ??
    args.user ??
    (await question('Email: '));
  const fullName =
    args.name ??
    args.fullName ??
    (await question('Full name: '));
  const password =
    args.password ??
    (await question('Password: ', { silent: true }));
  const roleInput = (args.role ?? 'user').toLowerCase();
  const role = REQUIRED_ROLE_VALUES.has(roleInput) ? roleInput : 'user';

  if (!email || !password) {
    stderr.write('Email and password are required.\n');
    exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const passwordHash = await bcrypt.hash(password, 12);

  const { error } = await supabase.from('app_users').insert({
    email: email.toLowerCase(),
    full_name: fullName || email,
    password_hash: passwordHash,
    role,
  });

  if (error) {
    stderr.write(`Failed to create user: ${error.message}\n`);
    exit(1);
  }

  stdout.write(`✅ Created ${role} user for ${email.toLowerCase()}\n`);
  exit(0);
}

main().catch((err) => {
  stderr.write(`Unexpected error: ${err.message}\n`);
  exit(1);
});
