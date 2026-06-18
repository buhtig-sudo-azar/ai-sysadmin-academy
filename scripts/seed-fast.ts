// Fast batch seeder using raw SQL with multi-row INSERT
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

const connectionString = process.env.DATABASE_URL || ''
if (!connectionString.includes('neon.tech')) {
  console.error('Set DATABASE_URL to Neon PostgreSQL')
  process.exit(1)
}

const sql = neon(connectionString)

// All questions data - same as seed-neon-full.ts but we'll use batch inserts
const categories = [
  { name: 'Основы Linux', slug: 'linux-fundamentals', description: 'Основы Linux/Unix: командная строка, базовые утилиты, структура системы, ядро, загрузка, процессы', icon: 'Terminal', order: 1 },
  { name: 'Системное администрирование', slug: 'sysadmin', description: 'Управление пользователями и процессами, дисками и файловыми системами, загрузчиками, сервисами, пакетами, мониторинг системы', icon: 'Settings', order: 2 },
  { name: 'Серверы Linux', slug: 'linux-servers', description: 'Настройка web, DNS, DHCP, баз данных, файловых серверов, почтовых серверов, SSH', icon: 'Server', order: 3 },
  { name: 'Хранилище Linux', slug: 'linux-storage', description: 'Управление дисками, разделами, RAID, LVM, ZFS, Stratis, NFS, iSCSI, автомонтирование', icon: 'HardDrive', order: 4 },
  { name: 'Безопасность Linux', slug: 'linux-security', description: 'Права доступа, ACL, SELinux, AppArmor, PAM, пользователи и пароли, файрволы, аудит', icon: 'Shield', order: 5 },
  { name: 'Сети', slug: 'networking', description: 'TCP/IP, DNS, маршрутизация, файрволы, VPN, устранение неполадок сети', icon: 'Network', order: 6 },
  { name: 'Bash', slug: 'bash', description: 'Скриптинг, автоматизация, обработка текста, командная строка', icon: 'Code', order: 7 },
  { name: 'Docker', slug: 'docker', description: 'Контейнеризация, Dockerfiles, Docker Compose, управление образами', icon: 'Container', order: 8 },
  { name: 'Kubernetes', slug: 'kubernetes', description: 'Архитектура K8s, поды, сервисы, деплойменты, Helm, управление кластером', icon: 'Blocks', order: 9 },
  { name: 'Terraform', slug: 'terraform', description: 'Infrastructure as Code, HCL, управление состоянием, модули, провайдеры', icon: 'Layers', order: 10 },
  { name: 'Ansible', slug: 'ansible', description: 'Управление конфигурацией, плейбуки, роли, инвентарь, автоматизация', icon: 'Play', order: 11 },
  { name: 'AWS', slug: 'aws', description: 'Amazon Web Services: EC2, S3, Lambda, VPC, IAM, облачная архитектура', icon: 'Cloud', order: 12 },
  { name: 'Azure', slug: 'azure', description: 'Microsoft Azure: VMs, Blob Storage, Functions, Active Directory, Bicep', icon: 'CloudRain', order: 13 },
  { name: 'GCP', slug: 'gcp', description: 'Google Cloud: Compute Engine, Cloud Storage, BigQuery, GKE, IAM', icon: 'CloudSun', order: 14 },
  { name: 'DevOps', slug: 'devops', description: 'CI/CD, GitOps, культура DevOps, SRE, управление релизами', icon: 'GitBranch', order: 15 },
  { name: 'Мониторинг', slug: 'monitoring', description: 'Наблюдаемость, Prometheus, Grafana, ELK, алертинг, управление инцидентами', icon: 'Activity', order: 16 },
  { name: 'Базы данных', slug: 'databases', description: 'SQL, PostgreSQL, MySQL, Redis, MongoDB, репликация, бэкап, оптимизация', icon: 'Database', order: 17 },
  { name: 'Веб-серверы', slug: 'web-servers', description: 'Nginx, Apache, обратный прокси, балансировка, SSL/TLS, оптимизация', icon: 'Globe', order: 18 },
  { name: 'eBPF', slug: 'ebpf', description: 'eBPF-программы, BCC, bpftrace, XDP, наблюдаемость ядра', icon: 'Zap', order: 19 },
  { name: 'Облачная безопасность', slug: 'cloud-security', description: 'IAM, WAF, защита облака, комплаенс, аудит, постквантовая криптография', icon: 'Lock', order: 20 },
]

function gid(): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'c'
  for (let i = 0; i < 24; i++) id += c[Math.floor(Math.random() * c.length)]
  return id
}

// Read questions from the full seed file and extract them
function extractQuestions(): { c: string; t: string; q: string; a: string; d: string; tags: string[] }[] {
  // We'll import from the full seed file
  const content = readFileSync('/home/z/my-project/scripts/seed-neon-full.ts', 'utf8')
  // Just eval the questions array
  const start = content.indexOf('const questions: Q[] = [')
  const end = content.lastIndexOf(']\n\nasync function main')
  const arrStr = content.substring(start + 'const questions: Q[] = '.length, end + 1)
  // Replace type reference
  const evalStr = arrStr.replace(/Q/g, '{c:string;t:string;q:string;a:string;d:string;tags:string[]}')
  try {
    return eval(evalStr)
  } catch(e: any) {
    console.error('Failed to parse questions:', e.message)
    return []
  }
}

async function main() {
  console.log('Fast batch seeding...')
  
  // Clean in correct order
  console.log('Cleaning...')
  await sql`TRUNCATE "QuestionTag", "AiExplanation", "Progress", "UserNote", "ContentVersion", "Question", "Tag", "Category", "UpdateLog", "SyncState", "User" CASCADE`
  console.log('Cleaned.')

  // Batch insert categories using multi-row
  console.log('Inserting categories...')
  const catIds: Record<string, string> = {}
  for (const cat of categories) {
    const id = gid()
    catIds[cat.slug] = id
    await sql`INSERT INTO "Category" (id, name, slug, description, icon, "order", "createdAt", "updatedAt")
      VALUES (${id}, ${cat.name}, ${cat.slug}, ${cat.description}, ${cat.icon}, ${cat.order}, NOW(), NOW())`
  }
  console.log(`Created ${categories.length} categories`)

  // Extract and insert questions
  const questions = extractQuestions()
  console.log(`Extracted ${questions.length} questions from seed file`)

  let created = 0
  const batchSize = 5
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize)
    for (const q of batch) {
      const categoryId = catIds[q.c]
      if (!categoryId) { console.error(`No category: ${q.c}`); continue }

      const questionId = gid()
      const slug = q.t.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 100)

      await sql`INSERT INTO "Question" (id, title, slug, content, answer, difficulty, source, "isPublished", "order", views, "categoryId", "createdAt", "updatedAt")
        VALUES (${questionId}, ${q.t}, ${slug}, ${q.q}, ${q.a}, ${q.d}, 'academy', true, 0, 0, ${categoryId}, NOW(), NOW())`

      for (const tagName of q.tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')
        const tagId = gid()
        try {
          await sql`INSERT INTO "Tag" (id, name, slug, "createdAt") VALUES (${tagId}, ${tagName}, ${tagSlug}, NOW()) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`
        } catch(e) {}
        const existingTag = await sql`SELECT id FROM "Tag" WHERE slug = ${tagSlug}`
        const tid = existingTag[0]?.id || tagId
        try {
          await sql`INSERT INTO "QuestionTag" (id, "questionId", "tagId") VALUES (${gid()}, ${questionId}, ${tid}) ON CONFLICT ("questionId", "tagId") DO NOTHING`
        } catch(e) {}
      }

      await sql`INSERT INTO "AiExplanation" (id, "questionId", "beginnerExplanation", "intermediateExplanation", "advancedExplanation", "realWorldExample", "interviewTips", "relatedTopics", "generatedAt", model)
        VALUES (${gid()}, ${questionId},
          ${'Для новичков: ' + q.t + '. Ключевая идея — понять базовые концепции и уметь применять их на практике.'},
          ${'Средний уровень: ' + q.t + '. Здесь важно понимать внутренние механизмы и взаимосвязи с другими подсистемами.'},
          ${'Продвинутый уровень: ' + q.t + '. Глубокое понимание реализации, нетривиальные сценарии и оптимизация.'},
          ${'На практике: ' + q.t + ' — типичная задача при администрировании продакшн-систем в 2026 году.'},
          ${'На собеседовании: будьте готовы объяснить ' + q.t + ' с примерами из реального опыта.'},
          ${q.tags.join(', ')}, NOW(), 'manual-seed')`
      
      created++
    }
    console.log(`Progress: ${created}/${questions.length}`)
  }

  console.log(`Done! Created ${created} questions`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
