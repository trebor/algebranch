# Algebrator



Include a description of the project here. Don't forget to include a [link](https://twitter.com/) to
the blog post where this visualization is featured (if any).

## Author(s)

 * [Robert Harris](https://twitter.com/trebor)

## Development

### Run

To run in development mode

```
gulp
```

See your site at [localhost:7000](http://localhost:7000). It will automagically refresh when you change the code (via browsersync).

To run in production mode

```
gulp --production
```

### Test

Run this command to test once.

```
gulp test
```

Or run this command to test and retest when files are changed.

```
gulp tdd
```

Test coverage will be generated to ```coverage``` directory.

### Deployment

#### Staging

```
# copy to ../../interactive-staging/public
npm run stage
# deploy via hayaku
npm run hayaku
```

#### Production

This will copy the files to ../../interactiveprod but does not add, commit or push to production repo yet. You have to do that manually.

```
npm run deploy
```