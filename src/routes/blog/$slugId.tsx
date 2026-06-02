import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { getBlogPageData } from "../../serverFns";

export const Route = createFileRoute("/blog/$slugId")({
  loader: async ({ params }) => {
    const blog = await getBlogPageData({ data: params.slugId });
    if (!blog) throw notFound();
    return blog;
  },
  head: ({ loaderData, params }) => {
    const blog = loaderData;
    const siteUrl = getSiteUrl();
    const url = `${siteUrl}/blog/${params.slugId}`;
    const title = blog ? `${blog.title} | IfeShades & More Journal` : "Blog post | IfeShades & More";
    const description = blog?.excerpt || "Read the latest eyewear styling notes from IfeShades & More.";
    const image = absoluteUrl(blog?.image || "/preview/hero-v1-gallery.jpg", siteUrl);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image }
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: blog
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: blog.title,
                description,
                image,
                author: {
                  "@type": "Person",
                  name: blog.author || "IfeShades & More"
                },
                datePublished: blog.createdAt,
                dateModified: blog.updatedAt,
                mainEntityOfPage: url
              })
            }
          ]
        : []
    };
  },
  component: BlogPage
});

function BlogPage() {
  const blog = Route.useLoaderData();
  const paragraphs = String(blog.content || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className="page blog-page">
      <main className="site-shell blog-shell">
        <article className="container blog-article">
          <Link className="legal-back-link" to="/" hash="editorial">
            Back to blog
          </Link>
          {blog.image ? (
            <div className="blog-hero-image">
              <img src={blog.image} alt="" />
            </div>
          ) : null}
          <p className="blog-kicker">Journal</p>
          <h1>{blog.title}</h1>
          {blog.excerpt ? <p className="blog-excerpt">{blog.excerpt}</p> : null}
          <p className="blog-meta">
            {blog.author || "IfeShades & More"} · {formatDate(blog.createdAt)}
          </p>
          <div className="blog-body">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "Style guide";
  return date.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" });
}

function getSiteUrl() {
  return String(import.meta.env.VITE_SITE_URL || import.meta.env.VITE_FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function absoluteUrl(value: string, siteUrl: string) {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
