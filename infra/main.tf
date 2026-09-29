provider "aws" {
  region = "ap-south-2"
}

data "aws_region" "current" {}



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

resource "aws_key_pair" "deployer" {
  key_name   = "app_ec2_key"
  public_key = file("~/.ssh/id_ed25519.pub")
}

resource "aws_s3_bucket" "content_assets" {
  bucket        = "learn-kannada-assets"
  force_destroy = false

  tags = {
    Name = "learn-kannada-assets"
  }
}

resource "aws_s3_bucket_ownership_controls" "content_assets" {
  bucket = aws_s3_bucket.content_assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "content_assets" {
  bucket                  = aws_s3_bucket.content_assets.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "content_assets" {
  bucket = aws_s3_bucket.content_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "content_assets" {
  bucket = aws_s3_bucket.content_assets.id

  cors_rule {
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = [
      "https://dev.learnkannada.co.in",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_policy" "content_assets" {
  bucket = aws_s3_bucket.content_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontReadContentAssets"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.content_assets.arn}/assets/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.content_assets.arn
        }
      }
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.content_assets]
}

resource "aws_cloudfront_origin_access_control" "content_assets" {
  name                              = "learn-kannada-assets-oac"
  description                       = "Private S3 access for Learn Kannada content assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "content_assets" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Learn Kannada content assets"
  price_class     = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.content_assets.bucket_regional_domain_name
    origin_id                = "learn-kannada-content-assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.content_assets.id
  }

  default_cache_behavior {
    target_origin_id       = "learn-kannada-content-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  depends_on = [aws_s3_bucket_ownership_controls.content_assets]
}

resource "aws_iam_role" "app_s3_assets" {
  name = "learn-kannada-app-s3-assets"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "app_s3_assets" {
  name = "learn-kannada-content-assets"
  role = aws_iam_role.app_s3_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:GetObject"]
      Resource = "${aws_s3_bucket.content_assets.arn}/assets/*"
    }]
  })
}

resource "aws_iam_instance_profile" "app_s3_assets" {
  name = "learn-kannada-app-s3-assets"
  role = aws_iam_role.app_s3_assets.name
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

/*
resource "aws_security_group" "observability_sg" {
  name        = "observability-security-group"
  description = "Security group for observability server"



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
    description = "Allow HTTP"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "Allow HTTP"
    from_port   = 9090
    to_port     = 9090
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
    Name = "observability-security-group"
  }
}
*/


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
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = "t3.micro"
  iam_instance_profile = aws_iam_instance_profile.app_s3_assets.name

  vpc_security_group_ids = [
    aws_security_group.app.id
  ]

  key_name = aws_key_pair.deployer.key_name

  tags = {
    Name = "app_server"
  }
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app_server.id
}

resource "aws_route53_zone" "private" {
  name = "learnkannada.co.in"

  vpc {
    vpc_id = data.aws_vpc.default.id
  }

  comment = "Private DNS zone for internal services"
}

resource "aws_route53_record" "database" {
  zone_id = aws_route53_zone.private.zone_id

  name = "db.learnkannada.co.in"
  type = "CNAME"
  ttl  = 300

  records = [aws_db_instance.postgres.address]
}

resource "aws_route53_record" "root" {
  zone_id = data.aws_route53_zone.main.zone_id

  name    = "dev.learnkannada.co.in"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

/*
resource "aws_instance" "observability_server" {

  ami = data.aws_ami.ubuntu.id

  instance_type = "t3.micro"

  vpc_security_group_ids = [
    aws_security_group.observability_sg.id
  ]
  key_name = aws_key_pair.deployer.key_name

  tags = {
    Name = "observability_server"
  }

}
*/

