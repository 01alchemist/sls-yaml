## Serverless YAML extension parser 
[![CircleCI]][ci-sls-yaml] [![Maintainability]][codeclimate] [![Test Coverage]][coverage]

This tiny library will parse YAML extensions used in serverless framework.

### Supported extensions
- [Include external file](#include-external-file) `${file(path/to/file.yml)}`
- [Inject environment variable](#inject-environment-variable) `${env:NODE_ENV}`
- [Inject global variables](#inject-global-variables) `${global:path.to.variable}`
- [Inject local variables](#inject-local-variables) `${self:path.to.variable}`
- [Inject current git branch](#inject-current-git-branch)* `${git:branch}`
- [Inject last git commit hash](#inject-last-git-commit-hash)* `${git:sha1}`

`* - New extension not present in serverless yaml`

### Include external file
This extension will include content of external yaml files.

- config.yml
```yaml 
version : 1
env: dev
config: ${file(./common.yml)}
```

- common.yml
```yaml
endpoint: http://service-url
```

- Generated final yaml
```yaml
version : 1
env: dev
config: 
  endpoint: http://service-url
```


### Inject environment variable
This extension will inject envronment values

- config.yml `export NODE_ENV = development`
```yaml 
version : 1
env: ${env:NODE_ENV}
```

- Generated final yaml
```yaml 
version : 1
env: development
```

### Inject global variables
This extension will inject variable from global scope.

- config.yml
```yaml 
version : 1
env: stage
config: ${file(./common.yml)}
```

- common.yml
```yaml
endpoint: http://service-${global:env}
```

- Generated final yaml
```yaml
version : 1
env: stage
config: 
  endpoint: http://service-stage
```

### Inject local variables
This extension will inject variable from local scope.

- config.yml
```yaml 
version : 1
env: stage
config: ${file(./common.yml)}
```

- common.yml
```yaml
port: 8080
endpoint: http://service:${self:port}
```

- Generated final yaml
```yaml
version : 1
env: stage
config: 
  port: 8080
  endpoint: http://service:8080
```

### Inject current git branch 
This extension will inject current git branch name

- config.yml
```yaml 
branch: ${git:branch}
```

### Inject last git commit hash 
This extension will inject last git commit hash

- config.yml
```yaml 
image.tag: ${git:sha1}
```


[CircleCI]:https://circleci.com/gh/01alchemist/sls-yaml/tree/master.svg?style=svg
[ci-sls-yaml]:https://circleci.com/gh/01alchemist/sls-yaml/tree/master
[Maintainability]:https://api.codeclimate.com/v1/badges/d3b19c4c45ebf451faf3/maintainability
[codeclimate]:https://codeclimate.com/github/01alchemist/sls-yaml/maintainability
[Test Coverage]:https://api.codeclimate.com/v1/badges/d3b19c4c45ebf451faf3/test_coverage
[coverage]:https://codeclimate.com/github/01alchemist/sls-yaml/test_coverage
