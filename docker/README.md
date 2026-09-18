# Docker

Development currently runs Redis from `docker-compose.yml` at the repository root.

SQL Server is **not** containerized. The application connects to the existing
`DigitalSocialMedia` database through `DATABASE_URL`.
