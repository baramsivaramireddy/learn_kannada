provider "aws" {
  region = "ap-south-2"
}



variable "db_username" {
  type        = string
  description = "PostgreSQL master username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL master password"
}


#ssh-keygen -t ed25519 -C "aap key"
# ssh /home/siva/.ssh/id_ed25519.pub

data "aws_ami" "ubuntu" {

  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]

  }
  owners = ["099720109477"]
}

data "aws_route53_zone" "main" {
  name = "learnkannada.co.in"
}
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_key_pair" "deployer"{
  key_name = "app_ec2_key"
  public_key = file("~/.ssh/id_ed25519.pub")
}

resource "aws_security_group" "app" {
  name        = "app-security-group"
  description = "Security group for application server"
  


  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }


  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

 
  ingress {
    description = "Allow SSH from my IP"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    #cidr_blocks = ["personal ip/32"]
    cidr_blocks = ["0.0.0.0/0"]
  }


  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "app-security-group"
  }
}

resource "aws_security_group" "database" {
  name        = "database-security-group"
  description = "Security group for PostgreSQL RDS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from application server"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "database-security-group"
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "postgres-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "postgres-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "learnkannada-postgres"

  engine         = "postgres"
  engine_version = "17"

  instance_class = "db.t3.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "learnkannada"
  username = var.db_username
  password = var.db_password

  db_subnet_group_name = aws_db_subnet_group.postgres.name

  vpc_security_group_ids = [
    aws_security_group.database.id
  ]

  publicly_accessible = false

  skip_final_snapshot = true

  backup_retention_period = 0

  tags = {
    Name = "learnkannada-postgres"
  }
}

resource "aws_instance" "app_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"

  vpc_security_group_ids = [
    aws_security_group.app.id
  ]

  key_name = aws_key_pair.deployer.key_name

  tags = {
    Name = "app_server"
  }
}

resource "aws_eip" "app" {
  domain = "vpc"
  instance =  aws_instance.app_server.id
}

resource "aws_route53_zone" "private" {
  name = "learnkannada.co.in"

  vpc {
    vpc_id = data.aws_vpc.default.id
  }

  comment = "Private DNS zone for internal services"
}

resource "aws_route53_record" "database" {
  zone_id = data.aws_route53_zone.main.zone_id

  name = "db.learnkannada.co.in"
  type = "CNAME"
  ttl  = 300

  records = [aws_db_instance.postgres.address]
}

resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id

  name = "dev.learnkannada.co.in"
  type = "A"
  ttl = 300
  records = [aws_eip.app.public_ip]
}