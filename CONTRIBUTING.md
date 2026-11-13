# Contributing

## Sprint 1

Sprint 1 was the foundation of the site.

- Homepage: Jake
- Fellowship / Pathway: Kat
- Lab Mission: Henry
- Events page: Skhy

## Branching

- Start from `main` and use a branch named `feature/short-name`.
- Open a pull request into `main`.
- At least one teammate reviews the pull request.
- Tell the team before merging, so they can review the work before it lands on `main`.

## Commits

Use a short imperative message that says why the change exists.

Recent messages in this repo look like: `Update approved Microsoft Lists content`

## Editing the site

Edit page content in the HTML files at the repo root. Edit the shared header and footer in `src/partials/header.html` and `src/partials/footer.html`. Do not paste a new copy of either into a page. A page includes them with:

```html
<!-- @include header current=fellowship -->
<!-- @include footer -->
```

`current` is `home`, `industry`, `fellowship`, `outcomes`, `events`, or `insights`. Leave it off on a page that is not in the menu, such as the 404 page. Home is the only page whose logo points at `#top`. Every other page points the logo at `index.html`.

Preview with `npm run dev`. That builds `dist/` and serves the built pages. The raw files still contain the include markers, so serving the repo root leaves the header and footer out.

The site is published from `dist/`. Build that folder with `npm run build`. The public URL and host are still TODO in the README.

## Git help

If you need help with Git, ask before you push.
