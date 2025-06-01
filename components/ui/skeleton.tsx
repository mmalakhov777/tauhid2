import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/60',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

// Enhanced skeleton with wave animation
function SkeletonWave({
  className,
  delay = 0,
  style,
}: { 
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: [0.4, 0.8, 0.4],
        scale: [0.95, 1, 0.95]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
      className={cn(
        'relative overflow-hidden rounded-md bg-gradient-to-r from-muted/40 via-muted/80 to-muted/40',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
        className
      )}
      style={style}
    />
  );
}

// Animated text skeleton with typing effect
function SkeletonText({
  className,
  lines = 1,
  delay = 0,
}: { 
  className?: string;
  lines?: number;
  delay?: number;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ width: 0, opacity: 0 }}
          animate={{ 
            width: i === lines - 1 ? '75%' : '100%',
            opacity: [0, 0.6, 1, 0.6]
          }}
          transition={{
            width: { duration: 1.5, delay: delay + i * 0.3 },
            opacity: { duration: 2, repeat: Infinity, delay: delay + i * 0.2 }
          }}
          className={cn(
            'h-4 rounded-md bg-gradient-to-r from-muted/50 via-muted/80 to-muted/50',
            'relative overflow-hidden',
            'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent'
          )}
        />
      ))}
    </div>
  );
}

// Pulsing dot animation for thinking indicator
function SkeletonDots({
  className,
}: { 
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
          className="w-2 h-2 rounded-full bg-primary/60"
        />
      ))}
    </div>
  );
}

// Card skeleton with beautiful animations
function SkeletonCard({
  className,
  delay = 0,
}: { 
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        scale: 1,
      }}
      transition={{
        duration: 0.6,
        delay,
        ease: "easeOut"
      }}
      className={cn(
        'rounded-lg border border-border/50 bg-card/50 p-4',
        'relative overflow-hidden',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_3s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        className
      )}
    >
      <div className="space-y-3">
        <SkeletonWave className="h-4 w-full" delay={delay} />
        <SkeletonWave className="h-3 w-3/4" delay={delay + 0.1} />
        <div className="flex gap-2 pt-1">
          <SkeletonWave className="h-5 w-16 rounded-full" delay={delay + 0.2} />
          <SkeletonWave className="h-5 w-20 rounded-full" delay={delay + 0.3} />
          <SkeletonWave className="h-5 w-24 rounded-full" delay={delay + 0.4} />
        </div>
      </div>
    </motion.div>
  );
}

export { Skeleton, SkeletonWave, SkeletonText, SkeletonDots, SkeletonCard };
