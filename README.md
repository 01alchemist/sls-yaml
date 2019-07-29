## Serverless YAML extension parser

This tiny library will parse YAML extensions used in serverless framework.

### Supported extensions
- Include external file. `${file(path/to/file.yml)}`
- Inject environment variable. `${env:NODE_ENV}`
- Inject global variables. `${global:path.to.variable}`
- Inject self(local) variables. `${self:path.to.variable} 
