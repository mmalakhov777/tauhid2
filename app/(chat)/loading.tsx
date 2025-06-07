'use client';

import { motion } from 'framer-motion';
import { SkeletonWave } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background overflow-hidden pb-5 md:pb-0">
      {/* Centered layout for empty state skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-3 md:px-4 w-full max-w-3xl mx-auto overflow-hidden">
        {/* Greeting section skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 sm:mb-8 w-full max-w-full"
        >
          <div className="mb-2">
            <SkeletonWave className="h-8 sm:h-10 md:h-12 w-48 sm:w-56 md:w-64" delay={0.1} />
          </div>
          <div>
            <SkeletonWave className="h-6 sm:h-7 md:h-8 w-64 sm:w-72 md:w-80" delay={0.2} />
          </div>
        </motion.div>
        
        {/* Input section skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full max-w-full mb-4 sm:mb-6"
        >
          <SkeletonWave className="h-12 w-full rounded-xl" delay={0.3} />
        </motion.div>
        
        {/* Suggested actions skeleton */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="w-full max-w-full"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonWave
                key={i}
                className="h-10 rounded-lg"
                delay={0.4 + i * 0.1}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
} 