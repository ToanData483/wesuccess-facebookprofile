import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-lg',
          'bg-gray-50 border',
          error ? 'border-red-400' : 'border-gray-200',
          'text-gray-900 placeholder:text-gray-400',
          'focus:outline-none focus:border-[#1877F2] focus:ring-1 focus:ring-[#1877F2]',
          'transition-all duration-200',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
