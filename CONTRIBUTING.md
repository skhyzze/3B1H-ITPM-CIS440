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

## Unfinished copy

Placeholder text is marked with `data-unfinished` or an existing pending class (`.content-pending`, `.coming-soon`, `.demo-notice`, and the image-slot labels). A whole section can carry `data-unfinished` too, which hides its heading along with the copy. Those stay hidden. To preview them while writing the real copy, add `data-show-unfinished` to the `<html>` tag of that page. Remove the attribute before publishing.

## Industry Partners

`showIndustryPartners` in `js/config.js` is the switch. While it is `false`, `npm run build` leaves Industry Partners out of the header, footer, and home cards. `industry.html` stays reachable by its URL. The chatbot also drops that link. Set the flag to `true` and rebuild to show the links again.

## Editing the site

Edit page content in the HTML files at the repo root. Edit the shared header and footer in `src/partials/header.html` and `src/partials/footer.html`, then run `npm run build`. The build copies those partials into each page. The page's `data-nav-current` value sets `aria-current="page"` and the logo link. Home is the only page whose logo points at `#top`. Every other page points the logo at `index.html`.

Preview with `npm run dev`, or serve the repo root. The header and footer are in each page, and the build refreshes them from `src/partials/` so the published copy stays on one source.

The site is published from `dist/`. Build that folder with `npm run build`. The public URL and host are still TODO in the README.

## Git help

If you need help with Git, ask before you push.
