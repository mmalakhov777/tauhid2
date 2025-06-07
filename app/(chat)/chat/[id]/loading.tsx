'use client';

import { motion } from 'framer-motion';
import { SkeletonCard, SkeletonText, SkeletonWave } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background overflow-hidden pb-5 md:pb-0">
      {/* Messages area with skeleton loading */}
      <div className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4 relative bg-background text-foreground">
        <div className="w-full mx-auto max-w-3xl px-4 space-y-6">
          {/* Simulate a few message exchanges */}
          
          {/* User message skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0 }}
            className="flex justify-end"
          >
            <div className="bg-muted rounded-xl px-3 py-2 max-w-2xl">
              <SkeletonWave className="h-4 w-48" delay={0.1} />
            </div>
          </motion.div>

          {/* Assistant message skeleton */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-full"
          >
            <div className="flex gap-4 w-full">
              <div className="flex flex-col gap-4 w-full">
                {/* Citation cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SkeletonCard delay={0.2} />
                  <SkeletonCard delay={0.3} />
                </div>
                
                {/* Message content skeleton */}
                <SkeletonText lines={4} delay={0.4} />
              </div>
            </div>
          </motion.div>

          {/* Another user message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex justify-end"
          >
            <div className="bg-muted rounded-xl px-3 py-2 max-w-2xl">
              <SkeletonWave className="h-4 w-32" delay={0.5} />
            </div>
          </motion.div>

          {/* Another assistant message */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="w-full"
          >
            <div className="flex gap-4 w-full">
              <div className="flex flex-col gap-4 w-full">
                {/* Single citation card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <SkeletonCard delay={0.6} />
                </div>
                
                {/* Message content skeleton */}
                <SkeletonText lines={2} delay={0.7} />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Input area skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="flex mx-auto px-2 gap-2 w-full md:max-w-3xl"
      >
        <div className="flex w-full relative">
          <SkeletonWave className="h-12 w-full rounded-xl" delay={0.8} />
        </div>
      </motion.div>
    </div>
  );
} 