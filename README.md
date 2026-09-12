# Learn Kannada

Learn Kannada is deployed as a small AWS application with a static Next.js frontend, an Express API, and a private PostgreSQL database.

## Architecture

```text
Browser
	|
	v
Nginx on EC2
	|-- /       -> /opt/learn-kannada/frontend/out (static Next.js files)
	|-- /api/  -> Express on 127.0.0.1:4000
										|
										v
								 Private RDS PostgreSQL
```

- Terraform creates the EC2 instance, Elastic IP, security groups, RDS PostgreSQL instance, and DNS records.
- Ansible clones this repository onto the EC2 instance and deploys the application.
- Nginx serves the static frontend directly. There is no frontend daemon.
- Express runs as the `learn-kannada-backend` systemd service.
- Prisma is used by Express for the PostgreSQL connectivity check.

## Repository Layout

```text
backend/                 Express API and Prisma client
frontend/                Static-exported Next.js application
infra/                   Terraform AWS infrastructure
infra/ansible/           Server deployment playbook and templates
```

## Backend API

The backend listens on port `4000`.

```text
GET /health       API process health check
GET /db-health    Prisma PostgreSQL connectivity check
```

Through Nginx, the same routes are available at:

```text
GET https://dev.learnkannada.co.in/api/health
GET https://dev.learnkannada.co.in/api/db-health
```


## Local Development

### Backend

Create `backend/.env` with the database settings. This file is ignored by Git.

```env
PORT=4000
DB_HOST=db.learnkannada.co.in
DB_PORT=5432
DB_NAME=learnkannada
db_username=your_database_username
db_password=your_database_password
```

Install and run the API:

```bash
cd backend
npm ci
npm run prisma:generate
npm run dev
```

Test it:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/db-health
```

The private RDS database is not reachable from a normal local machine. The database check should be run on the EC2 host, where the security group permits PostgreSQL traffic.

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

The frontend calls `/api/health` and `/api/db-health` in production through Nginx. For local development, run the backend on port `4000` and set `NEXT_PUBLIC_API_URL=http://localhost:4000` before starting Next.js.

Build the static site:

```bash
npm run build
```

The generated files are written to `frontend/out`.

## Infrastructure

Terraform uses the AWS region `ap-south-2` and requires database variables:

```hcl
db_username = "your_database_username"
db_password = "your_database_password"
```

Use a local ignored `infra/terraform.tfvars` file and never commit it.

```bash
cd infra
terraform init
terraform plan
terraform apply
```

Terraform outputs the application IP and database hostname:

```bash
terraform output app_public_ip
terraform output database_hostname
```

## Server Deployment

The Ansible inventory targets `dev.learnkannada.co.in` using the Ubuntu user and SSH key configured in `infra/ansible/inventory.ini`.

Before running Ansible:

1. Push the application code to the GitHub repository configured in `system.yml`.
2. Confirm `backend/.env` exists locally and contains the database credentials.
3. Confirm DNS points `dev.learnkannada.co.in` to the Terraform Elastic IP.

Run the deployment:

```bash
cd infra/ansible
source .venv/bin/activate
ansible-playbook --syntax-check -i inventory.ini system.yml
ansible-playbook -i inventory.ini system.yml
```

The playbook:

- Installs Node.js, Git, and Nginx.
- Creates and enables a 2 GB swap file for the `t3.micro` build host.
- Clones or updates the GitHub repository at `/opt/learn-kannada`.
- Repairs the repository remote or recreates `/opt/learn-kannada` if it is not a valid Git checkout.
- Copies the ignored local `backend/.env` to the server with mode `0600`.
- Installs dependencies and generates the Prisma client.
- Builds the static Next.js site.
- Runs provisioning tasks with sudo and assigns `/opt/learn-kannada` to the `learnkannada` service user.
- Installs and starts the Express systemd service.
- Configures Nginx to serve the frontend and proxy `/api/` to Express.
- Obtains and verifies the HTTPS certificate with Certbot.

The playbook checks Nginx through `127.0.0.1` with the production `Host` header. This avoids failing when the EC2 instance cannot resolve its own public DNS name, even though the site works from a browser.

The Git, npm, Prisma, and frontend build tasks run with the playbook's normal sudo privileges. This avoids an ACL compatibility issue on some Ubuntu images when Ansible tries to become the unprivileged `learnkannada` user. The application files are reassigned to `learnkannada` before the backend service starts.

If Ansible reports an error like this:

```text
Failed to set permissions on the temporary files Ansible needs to create
chmod: invalid mode: 'A+user:learnkannada:rx:allow'
```

Make sure you are using the project virtual environment and rerun the playbook:

```bash
cd infra/ansible
source .venv/bin/activate
ansible-playbook --syntax-check -i inventory.ini system.yml
ansible-playbook -i inventory.ini system.yml
```

If `npm ci` fails with return code `-9` and no useful npm error, the Linux kernel likely stopped the process because the `t3.micro` ran out of memory. The playbook creates `/swapfile` before installing dependencies and limits the frontend build memory usage.

Useful server checks:

```bash
sudo systemctl status learn-kannada-backend
sudo journalctl -u learn-kannada-backend -f
curl http://127.0.0.1:4000/health
curl https://dev.learnkannada.co.in/api/health
curl https://dev.learnkannada.co.in/api/db-health
```

## SSH Host-Key Mismatch

If the EC2 instance was recreated, its SSH host key changes. SSH may then show:

```text
Offending ECDSA key in /home/siva/.ssh/known_hosts:18
Host key for dev.learnkannada.co.in has changed
Host key verification failed
```

Only remove the old key after confirming that DNS now points to the intended EC2 instance:

```bash
ssh-keygen -f "$HOME/.ssh/known_hosts" -R "dev.learnkannada.co.in"
```

Connect again and verify the new fingerprint against the EC2 instance or your trusted server record before accepting it:

```bash
ssh -i "$HOME/.ssh/id_ed25519" ubuntu@dev.learnkannada.co.in
```

The expected ED25519 fingerprint from the current deployment is:

```text
SHA256:BEraa2HHksZcb8Nc/kBdW07Q0wAkoAi38aFuGlSjdC8
```

After SSH succeeds, rerun Ansible:

```bash
cd infra/ansible
source .venv/bin/activate
ansible-playbook -i inventory.ini system.yml
```

## Ignored Files

The repository ignores Terraform state and variables, Node dependencies, Next.js build output, Python virtual environments, logs, and environment files. Commit lockfiles such as `backend/package-lock.json` and `frontend/package-lock.json`, but never commit credentials or Terraform state.
