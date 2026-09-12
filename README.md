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
- Clones or updates the GitHub repository at `/opt/learn-kannada`.
- Copies the ignored local `backend/.env` to the server with mode `0600`.
- Installs dependencies and generates the Prisma client.
- Builds the static Next.js site.
- Installs and starts the Express systemd service.
- Configures Nginx to serve the frontend and proxy `/api/` to Express.
- Obtains and verifies the HTTPS certificate with Certbot.

Useful server checks:

```bash
sudo systemctl status learn-kannada-backend
sudo journalctl -u learn-kannada-backend -f
curl http://127.0.0.1:4000/health
curl https://dev.learnkannada.co.in/api/health
curl https://dev.learnkannada.co.in/api/db-health
```

## Ignored Files

The repository ignores Terraform state and variables, Node dependencies, Next.js build output, Python virtual environments, logs, and environment files. Commit lockfiles such as `backend/package-lock.json` and `frontend/package-lock.json`, but never commit credentials or Terraform state.
