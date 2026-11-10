export default function HeroVideo() {
  return (
    <div className="heroVideoWrap" aria-hidden="true">
      <video
        className="heroVideo"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero-poster.jpg"
      >
        <source src="/hero-loop.mp4" type="video/mp4" />
      </video>
    </div>
  );
}