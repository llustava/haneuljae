import Image from "next/image";

type MdxImageProps = {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
};

export default function MdxImage({
  src,
  alt = "",
  caption,
  width = 1600,
  height = 900,
}: MdxImageProps) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 768px"
        className="h-auto w-full object-cover"
      />
      {caption ? (
        <figcaption className="px-4 py-3 text-sm text-white/70">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
