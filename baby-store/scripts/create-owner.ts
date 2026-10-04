// إنشاء حساب مالك المتجر (أو إعادة تعيين كلمة مرور حساب موجود)
// تفاعلي:      npm run owner:create
// غير تفاعلي:  npm run owner:create -- --username admin --name "اسم المالك" --password "كلمة مرور قوية"
import readline from 'node:readline'
import { db } from '../lib/server/db'
import { hashPassword, passwordProblem } from '../lib/server/security'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

function ask(q: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  return new Promise((resolve) => {
    if (hidden) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
      out._writeToOutput = (s: string) => {
        if (s.includes(q)) out.output.write(s)
        else out.output.write('*')
      }
    }
    rl.question(q, (a) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(a.trim())
    })
  })
}

async function main() {
  const username = arg('username') || (await ask('اسم المستخدم (حروف إنجليزية وأرقام): '))
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) throw new Error('اسم المستخدم غير صالح')
  const name = arg('name') || (await ask('الاسم الظاهر: ')) || username
  const password = arg('password') || (await ask('كلمة المرور (10 أحرف على الأقل): ', true))
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)
  const d = db()
  const existing = d.prepare('SELECT id FROM admin_users WHERE username=?').get(username) as { id: number } | undefined
  if (existing) {
    d.prepare("UPDATE admin_users SET password_hash=?, permissions='[\"owner\"]', active=1, failed_logins=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?").run(hashPassword(password), existing.id)
    d.prepare('DELETE FROM sessions WHERE user_id=?').run(existing.id)
    console.log(`✓ تم تحديث كلمة مرور الحساب ${username} ومنحه صلاحية المالك`)
  } else {
    d.prepare("INSERT INTO admin_users(username,name,password_hash,permissions) VALUES(?,?,?,'[\"owner\"]')").run(username, name, hashPassword(password))
    console.log(`✓ تم إنشاء حساب المالك ${username}. ادخل من /admin/login`)
  }
}

main().then(() => process.exit(0), (e) => {
  console.error('✗', e.message)
  process.exit(1)
})
