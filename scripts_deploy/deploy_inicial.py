"""
Deploy inicial do hesed-arabic na VPS.
- Copia todo o projeto local para /var/www/hesed-arabic
- Cria .env com credenciais corretas
- npm install + prisma db push + build
- PM2 na porta 3001
"""
import paramiko
import pathlib
import io
import os
import time

BASE       = pathlib.Path(r'C:\Users\X\OneDrive\Área de Trabalho\Controles por IAs\hesed-arabic')
REMOTE     = '/var/www/hesed-arabic'
# Coloque a chave aqui ou em variável de ambiente ANTHROPIC_API_KEY_ARABIC
ANTHROPIC  = os.environ.get('ANTHROPIC_API_KEY_ARABIC', 'SUA_CHAVE_ANTHROPIC_AQUI')
DB_URL     = 'postgresql://hesed_arabic:HesedArabic%402026@localhost:5432/hesed_arabic'

SKIP_DIRS  = {'.git', 'node_modules', '.next', '__pycache__', 'Documentação'}
SKIP_EXTS  = {'.pyc'}

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('82.29.62.120', username='root', password='Mamutgravador@23', timeout=15)
sftp = ssh.open_sftp()

def mkdir_p(sftp, path):
    parts = path.strip('/').split('/')
    current = ''
    for part in parts:
        if not part:
            continue
        current += '/' + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            try:
                sftp.mkdir(current)
            except Exception:
                pass

def upload_dir(local_path: pathlib.Path, remote_path: str):
    mkdir_p(sftp, remote_path)
    for item in local_path.iterdir():
        if item.name in SKIP_DIRS:
            continue
        if item.suffix in SKIP_EXTS:
            continue
        remote_item = remote_path + '/' + item.name
        if item.is_dir():
            upload_dir(item, remote_item)
        else:
            try:
                sftp.put(str(item), remote_item)
            except Exception as e:
                print(f'  WARN: {item} → {e}')

print('=== Fazendo upload dos arquivos ===')
upload_dir(BASE, REMOTE)
print('Upload concluído.')

# Criar .env na VPS
env_content = f'''DATABASE_URL="{DB_URL}"
NEXTAUTH_SECRET="hesed-arabic-secret-key-2026-production"
NEXTAUTH_URL="http://localhost:3001"
REDIS_URL="redis://localhost:6379"
ANTHROPIC_API_KEY={ANTHROPIC}
'''
sftp.putfo(io.BytesIO(env_content.encode()), REMOTE + '/.env')
print('OK: .env criado')
sftp.close()

# Build script
setup = f'''cd {REMOTE}

echo "=== NPM INSTALL ==="
npm install 2>&1
echo "npm exit=$?"

echo "=== PRISMA DB PUSH ==="
npx prisma db push --skip-generate 2>&1
echo "prisma exit=$?"

echo "=== BUILD ==="
npm run build 2>&1
BUILD_EXIT=$?
echo "exit=$BUILD_EXIT"

if [ $BUILD_EXIT -eq 0 ]; then
  echo "=== PM2 SETUP ==="
  pm2 delete hesed-arabic 2>/dev/null || true
  pm2 start npm --name hesed-arabic -- start
  pm2 save
  sleep 3
  echo -n "GET /app/login (port 3001): "
  curl -s -o /dev/null -w "%{{http_code}}" http://localhost:3001/app/login
  echo ""
  echo "=== DEPLOY OK ==="
fi
echo "=== FIM ==="
'''

sftp2 = ssh.open_sftp()
sftp2.putfo(io.BytesIO(setup.encode()), '/root/deploy_arabic.sh')
sftp2.close()

ssh.exec_command(
    'chmod +x /root/deploy_arabic.sh && rm -f /root/deploy_arabic.log && '
    'nohup /root/deploy_arabic.sh > /root/deploy_arabic.log 2>&1 &'
)
time.sleep(5)

print('\nAguardando build (pode demorar ~3 min)...')
for i in range(40):
    time.sleep(20)
    _, o, _ = ssh.exec_command(
        'tail -25 /root/deploy_arabic.log && echo ___ && '
        'ps aux | grep deploy_arabic | grep -v grep | wc -l'
    )
    out = o.read(4000).decode('utf-8', errors='replace')
    print(f'[{i+1}]\n{out[-600:]}')
    if 'FIM' in out and '___\n0' in out:
        print('=== DEPLOY FINALIZADO ===')
        break
    if 'Failed to compile' in out or 'Type error' in out:
        print('ERRO NO BUILD!')
        break

ssh.close()
