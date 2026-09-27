import {
  Apple,
  Cookie,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Leaf,
  Milk,
  Package,
  Sandwich,
  Soup,
  Wheat,
} from 'lucide-react';
import { useState } from 'react';

const thumbnailKinds = Object.freeze([
  { pattern: /fruit|apple|banana|mango|berry|orange|grape/, icon: Apple, tone: 'fruit' },
  { pattern: /vegetable|greens|spinach|salad|tomato|herb/, icon: Leaf, tone: 'greens' },
  { pattern: /rice|grain|oat|wheat|bread|flour|cereal|roti|chapati/, icon: Wheat, tone: 'grain' },
  { pattern: /paneer|cheese|milk|yogurt|curd|dairy/, icon: Milk, tone: 'dairy' },
  { pattern: /fish|seafood|salmon|tuna|prawn/, icon: Fish, tone: 'protein' },
  { pattern: /chicken|meat|mutton|lamb|turkey/, icon: Drumstick, tone: 'protein' },
  { pattern: /egg/, icon: Egg, tone: 'protein' },
  { pattern: /juice|drink|beverage|shake|smoothie/, icon: CupSoda, tone: 'drink' },
  { pattern: /cookie|biscuit|chocolate|dessert|sweet|snack/, icon: Cookie, tone: 'treat' },
  { pattern: /sandwich|burger|pizza|wrap/, icon: Sandwich, tone: 'meal' },
  { pattern: /soup|curry|dal|dhal|stew|meal/, icon: Soup, tone: 'meal' },
]);

function fallbackFor(food) {
  const searchable = `${food?.name || ''} ${food?.category || ''}`.toLocaleLowerCase('en-US');
  const match = thumbnailKinds.find(({ pattern }) => pattern.test(searchable));
  if (match) return match;
  if (food?.source?.provider === 'open_food_facts') return { icon: Package, tone: 'packaged' };
  return { icon: Soup, tone: 'meal' };
}

export function FoodThumbnail({ food, className = '' }) {
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const imageUrl = food?.imageUrl || '';

  const fallback = fallbackFor(food);
  const Icon = fallback.icon;
  const classes = ['food-thumbnail', `food-thumbnail--${fallback.tone}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-hidden="true">
      {imageUrl && failedImageUrl !== imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <Icon className="food-thumbnail__fallback" size={22} strokeWidth={1.8} />
      )}
    </span>
  );
}
