# Multics

Project page for **Multics: Generative Multi-Player World Model with Hierarchical Communication**.

This is a static website. No build step or package installation is required.

## Preview

From this directory, run:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Publish

1. Put this directory's **contents** at the root of the GitHub repository named `Multics`.
2. In **Settings → Pages**, choose **Deploy from a branch**, branch **main**, folder **/(root)**.
3. The project site will be available at `https://<username>.github.io/Multics/`.

All asset URLs are relative, so the page supports the `/Multics/` prefix.
The arXiv link in `index.html` is currently empty; update it when its URL is available. Code and Model links point to the TencentARC repositories.

[GitHub Pages publishing documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Fonts

DM Mono, Manrope, and Newsreader are bundled locally. Their SIL Open Font License files are included in the corresponding `assets/fonts/` directories.
