import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-white/10 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:backdrop-blur-sm',
        destructive:
          'bg-destructive/80 text-destructive-foreground shadow-lg hover:shadow-xl hover:shadow-destructive/25 hover:scale-[1.02] active:scale-[0.98] before:absolute before:inset-0 before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300 before:backdrop-blur-sm',
        outline:
          'border border-border bg-background/60 backdrop-blur-xl text-foreground shadow-lg hover:shadow-xl hover:bg-accent/80 hover:text-accent-foreground hover:border-border/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300',
        secondary:
          'bg-secondary/70 text-secondary-foreground backdrop-blur-xl border border-border/30 shadow-lg hover:shadow-xl hover:bg-secondary/60 hover:border-border/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300',
        ghost: 'bg-transparent hover:bg-accent/60 hover:text-accent-foreground hover:backdrop-blur-xl hover:border hover:border-border/30 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300',
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary/80 transition-colors duration-200',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
