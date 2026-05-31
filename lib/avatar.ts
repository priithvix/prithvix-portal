/**
 * Generate a deterministic color for avatar fallbacks based on a name
 */
export function getAvatarColor(name: string): string {
  // Color palette with good contrast (HSL values)
  const colors = [
    'hsl(142, 71%, 45%)', // Green (Primary)
    'hsl(217, 91%, 60%)', // Blue
    'hsl(271, 76%, 53%)', // Purple
    'hsl(25, 95%, 53%)',  // Orange
    'hsl(346, 77%, 50%)', // Red/Pink
    'hsl(189, 94%, 43%)', // Cyan
    'hsl(48, 96%, 53%)',  // Yellow
    'hsl(162, 73%, 46%)', // Teal
    'hsl(291, 47%, 51%)', // Magenta
    'hsl(204, 86%, 53%)', // Light Blue
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
