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

output "observability_server_id" {
  value = aws_instance.observability_server.public_ip
}

output "asset_bucket_name" {
  value = aws_s3_bucket.content_assets.bucket
}

output "asset_base_url" {
  value = "https://${aws_cloudfront_distribution.content_assets.domain_name}"
}

output "asset_cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.content_assets.id
}