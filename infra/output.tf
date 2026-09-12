output "app_public_ip" {
    value = aws_eip.app.public_ip
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "rds_port" {
  value = aws_db_instance.postgres.port
}

output "rds_database" {
  value = aws_db_instance.postgres.db_name
}

output "database_hostname" {
  value = aws_route53_record.database.fqdn
}