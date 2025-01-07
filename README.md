# My blog
https://wteuber.com

## Github repository
https://github.com/wteuber/wteuber.github.io

### Serve my blog locally

```sh
bundle exec jekyll serve -l
```

### Generate directory browser boilerplate HTLM

e.g. for public/
```sh
ruby -run -e httpd . -p 3000
curl http://127.0.0.1:3000/public/ > /tmp/wtghio.tmp
mv /tmp/wtghio.tmp public/index.html
```

### Convert Scratch projects to JavaScript

$ sb-edit --input path/to/project.sb3 --output path/to/output-folder

FMI, see https://github.com/leopard-js/sb-edit
https://leopardjs.com/
