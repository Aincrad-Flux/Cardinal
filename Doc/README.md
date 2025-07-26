# Cardinal Developer Documentation

This directory contains detailed technical documentation for developers working on the Cardinal project.

## 📁 Documentation Structure

### Core Documentation
- **[Architecture Overview](./architecture.md)** - System design and component interactions
- **[API Reference](./api-reference.md)** - Detailed API documentation with examples
- **[Database Schema](./database-schema.md)** - Database structure and relationships
- **[Security Guide](./security.md)** - Security implementation and best practices

### Component Documentation
- **[Services Documentation](./services.md)** - Business logic and service layer
- **[Controllers Documentation](./controllers.md)** - Request handling and routing
- **[Models Documentation](./models.md)** - Data models and database interactions
- **[Middleware Documentation](./middleware.md)** - Authentication, validation, and error handling
- **[Utilities Documentation](./utilities.md)** - Helper functions and utilities

### Deployment & Operations
- **[Docker Configuration](./docker.md)** - Docker setup and containerization
- **[Environment Configuration](./environment.md)** - Environment variables and configuration
- **[Logging & Monitoring](./logging.md)** - Logging setup and monitoring guidelines

### Development Guides
- **[Development Setup](./development-setup.md)** - Local development environment setup
- **[Testing Guide](./testing.md)** - Testing strategies and test writing
- **[Code Style Guide](./code-style.md)** - Coding standards and conventions
- **[Proxmox Integration](./proxmox-integration.md)** - Proxmox API integration details

### Troubleshooting & Maintenance
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions
- **[Performance Optimization](./performance.md)** - Performance tuning and optimization
- **[Backup & Recovery](./backup-recovery.md)** - Data backup and recovery procedures

## 🎯 Quick Navigation for New Developers

### First Time Setup
1. Read [Architecture Overview](./architecture.md) to understand the system
2. Follow [Development Setup](./development-setup.md) for local environment
3. Review [Code Style Guide](./code-style.md) for coding standards
4. Check [API Reference](./api-reference.md) for endpoint details

### Understanding the Codebase
1. **Entry Point**: Start with `src/index.js` - application initialization
2. **Routes**: Review `src/routes/webhook.js` - API endpoint definitions
3. **Controllers**: Check `src/controllers/webhookController.js` - request handling
4. **Services**: Examine `src/services/` - business logic implementation
5. **Models**: Study `src/models/` - data layer and database interactions

### Making Changes
1. **Features**: Add new routes → controllers → services → models
2. **Bug Fixes**: Check logs → identify component → apply fix → test
3. **Security**: Review [Security Guide](./security.md) before changes
4. **Testing**: Follow [Testing Guide](./testing.md) for test coverage

## 📋 Documentation Standards

When updating documentation:
- Keep technical accuracy as the top priority
- Include code examples for complex concepts
- Update related documentation when making changes
- Use clear headings and consistent formatting
- Include troubleshooting steps where applicable

## 🔄 Keeping Documentation Updated

- Documentation should be updated with every significant code change
- API changes must be reflected in API documentation
- New features require corresponding documentation
- Deprecated features should be clearly marked

## 📞 Getting Help

If you need clarification on any documentation:
1. Check the specific component documentation
2. Review the troubleshooting guides
3. Examine the code with documentation as reference
4. Create an issue for documentation improvements

---

This documentation is maintained by the development team and should be the primary reference for all technical questions about Cardinal.
