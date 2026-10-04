/**
 * TMDB requires visible attribution for any application using its API and
 * images: "This product uses the TMDB API but is not endorsed or certified by
 * TMDB." plus the TMDB logo.
 */
export function TmdbAttribution() {
  return (
    <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/70">
      本产品使用{" "}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        TMDB
      </a>{" "}
      API 但未经 TMDB 认可或认证。番剧数据来自{" "}
      <a
        href="https://anilist.co/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        AniList
      </a>
      。
    </p>
  );
}
