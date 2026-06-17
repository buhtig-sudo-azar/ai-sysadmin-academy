import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  { name: 'Linux', slug: 'linux', description: 'Основы Linux/Unix: командная строка, базовые утилиты, структура системы, ядро, процессы, файловые системы, systemd, пакетный менеджмент', icon: 'Terminal', order: 1 },
  { name: 'Сети', slug: 'networking', description: 'TCP/IP, DNS, маршрутизация, файрволы, VPN, устранение неполадок сети', icon: 'Network', order: 2 },
  { name: 'Bash', slug: 'bash', description: 'Скриптинг, автоматизация, обработка текста, командная строка', icon: 'Code', order: 3 },
  { name: 'Безопасность', slug: 'security', description: 'Харденинг, аутентификация, шифрование, уязвимости, комплаенс', icon: 'Shield', order: 4 },
  { name: 'Docker', slug: 'docker', description: 'Контейнеризация, Dockerfiles, Docker Compose, управление образами', icon: 'Container', order: 5 },
  { name: 'Kubernetes', slug: 'kubernetes', description: 'Архитектура K8s, поды, сервисы, деплойменты, Helm, управление кластером', icon: 'Blocks', order: 6 },
  { name: 'Terraform', slug: 'terraform', description: 'Infrastructure as Code, HCL, управление состоянием, модули, провайдеры', icon: 'Layers', order: 7 },
  { name: 'Ansible', slug: 'ansible', description: 'Управление конфигурацией, плейбуки, роли, инвентарь, автоматизация', icon: 'Play', order: 8 },
  { name: 'AWS', slug: 'aws', description: 'Amazon Web Services: EC2, S3, Lambda, VPC, IAM, облачная архитектура', icon: 'Cloud', order: 9 },
  { name: 'Azure', slug: 'azure', description: 'Microsoft Azure: VMs, Blob Storage, Functions, Active Directory, Bicep', icon: 'CloudRain', order: 10 },
  { name: 'GCP', slug: 'gcp', description: 'Google Cloud: Compute Engine, Cloud Storage, BigQuery, GKE, IAM', icon: 'CloudSun', order: 11 },
  { name: 'DevOps', slug: 'devops', description: 'CI/CD, GitOps, культура DevOps, SRE, управление релизами', icon: 'GitBranch', order: 12 },
  { name: 'Мониторинг', slug: 'monitoring', description: 'Наблюдаемость, Prometheus, Grafana, ELK, алертинг, управление инцидентами', icon: 'Activity', order: 13 },
  { name: 'Базы данных', slug: 'databases', description: 'SQL, PostgreSQL, MySQL, Redis, MongoDB, репликация, бэкап, оптимизация', icon: 'Database', order: 14 },
  { name: 'Веб-серверы', slug: 'web-servers', description: 'Nginx, Apache, обратный прокси, балансировка, SSL/TLS, оптимизация', icon: 'Globe', order: 15 },
  { name: 'Системное администрирование', slug: 'sysadmin', description: 'Управление пользователями и процессами, дисками и файловыми системами, загрузчиками, сервисами, пакетами, мониторинг системы', icon: 'Settings', order: 16 },
  { name: 'Хранилище данных', slug: 'storage', description: 'Диски, разделы, RAID, LVM, ZFS, Stratis, NFS, iSCSI, автомонтирование', icon: 'HardDrive', order: 17 },
  { name: 'Серверы', slug: 'servers', description: 'Настройка web, DNS, DHCP, баз данных, файловых серверов, почтовых серверов', icon: 'Server', order: 18 },
  { name: 'eBPF', slug: 'ebpf', description: 'eBPF-программы, BCC, bpftrace, XDP, наблюдаемость ядра, сетевая фильтрация', icon: 'Zap', order: 19 },
  { name: 'Облачная безопасность', slug: 'cloud-security', description: 'IAM, WAF, защита облака, комплаенс, аудит, постквантовая криптография', icon: 'Lock', order: 20 },
]
