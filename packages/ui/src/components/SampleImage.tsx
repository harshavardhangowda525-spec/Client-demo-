import { resolveImage } from '../lib/images';

export interface SampleImageProps {
  imageKey: string | null | undefined;
  alt?: string;
  ratio?: '4x3' | '3x4' | '16x9' | '1x1' | '21x9' | 'auto';
  sizes?: string;
  priority?: boolean;
  hover?: boolean;
  /** Show the "Sample" tag in the corner. */
  tag?: boolean;
  className?: string;
}

/**
 * Responsive, lazily-loaded image for AI-generated sample content. When the
 * image files have not been downloaded yet, an art-directed placeholder is
 * rendered on the server instead of a broken image.
 */
export function SampleImage({ imageKey, alt, ratio = '4x3', sizes = '(min-width: 900px) 50vw, 100vw', priority, hover, tag, className }: SampleImageProps) {
  const img = resolveImage(imageKey, alt);
  const cls = ['media', ratio !== 'auto' ? `media--${ratio}` : '', hover ? 'media--hover' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {tag && <span className="badge badge--demo media__tag">Sample image</span>}
      {img.src ? (
        <img
          src={img.src}
          srcSet={img.srcSet ?? undefined}
          sizes={sizes}
          alt={img.alt}
          width={img.width}
          height={img.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <div className="media__placeholder" role="img" aria-label={img.alt || 'Sample image placeholder'}>
          <span>Sample image</span>
        </div>
      )}
    </div>
  );
}
