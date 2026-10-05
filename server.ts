import express from "express";
import path from "path";
import axios from "axios";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' })); // Allow larger payloads for images

  // --- Gemini Setup ---
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // --- Hearth & Spice API Routes ---

  // Mood-to-Food Recommendation Endpoint
  app.post("/api/food/recommend", async (req, res) => {
    const { mood, userPreferences } = req.body;

    const fallbacks: Record<string, any[]> = {
      exhausted: [
        { title: "Warm Miso Soup", why: "Gentle on the stomach and deeply hydrating.", icon: "Soup" },
        { title: "Nkwobi", why: "Rich, spicy, and deeply nourishing for the soul.", icon: "Utensils" },
        { title: "Herbal Tea", why: "Calming warmth for a tired soul.", icon: "Coffee" }
      ],
      anxious: [
        { title: "Pounded Yam & Egusi", why: "Heavy, grounding comfort to center your energy.", icon: "Bento" },
        { title: "Creamy Pasta", why: "A soft, tactile hug in a bowl.", icon: "Soup" },
        { title: "Fresh Fruit Plate", why: "Natural sugars for a gentle lift.", icon: "IceCream" }
      ],
      celebratory: [
        { title: "Party Jollof Rice", why: "The ultimate Nigerian celebration dish.", icon: "Pizza" },
        { title: "Artisan Pizza", why: "Sharing joy, one slice at a time.", icon: "Pizza" },
        { title: "Decadent Gelato", why: "Because you earned a sweet moment.", icon: "IceCream" }
      ],
      lonely: [
        { title: "Catfish Pepper Soup", why: "Spicy warmth that feels like a hug.", icon: "Soup" },
        { title: "Family-style Lasagna", why: "Hearty, homemade feeling.", icon: "Soup" },
        { title: "Warm Fresh Bread", why: "The comforting smell of home.", icon: "Bento" }
      ],
      focused: [
        { title: "Salmon Quinoa Bowl", why: "Brain food for deep thinking.", icon: "Salad" },
        { title: "Moin Moin", why: "Clean protein to keep your brain sharp.", icon: "Bento" },
        { title: "Green Matcha", why: "Clean energy for your task.", icon: "Coffee" }
      ]
    };

    try {
      const prompt = `A user is feeling "${mood}". 
      Their preferences are: ${userPreferences || 'None'}.
      Suggest 3 specific food categories or dishes that would be perfect for this mood.
      Include at least one popular Nigerian dish in the suggestions.
      For each suggestion, provide:
      - title (short name)
      - why (one sentence reason why it fits the mood)
      - icon (a single lucide-react icon name that fits, e.g., 'Soup', 'Pizza', 'Coffee', 'Salad', 'IceCream', 'Bento', 'Utensils')
      
      Return as a JSON array of objects.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                why: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["title", "why", "icon"]
            }
          }
        }
      });

      const recommendations = JSON.parse(result.text);
      res.json(recommendations);
    } catch (error: any) {
      // Gracefully handle quota exhaustion or other API errors
      if (error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        console.warn("Gemini Quota hit, using fallbacks for recommendations.");
      } else {
        console.error("Food Recommendation Error:", error);
      }
      
      // Return fallback based on mood if AI fails
      const moodFallbacks = fallbacks[mood as keyof typeof fallbacks] || fallbacks.exhausted;
      res.json(moodFallbacks);
    }
  });

  app.post("/api/food/recipe", async (req, res) => {
    const { dishName } = req.body;

    const recipeFallbacks: Record<string, any> = {
      "Smoky Jollof Rice": {
        prepTime: "25 min",
        cookTime: "50 min",
        ingredients: [
          "3 cups Long grain parboiled rice",
          "5 large Roma tomatoes",
          "2 Red bell peppers (Tatashe)",
          "3 Scotch bonnet peppers (Atarodo)",
          "2 large Red onions",
          "1/2 cup Vegetable oil",
          "4 tbsp double concentrated Tomato paste",
          "3 cups rich Chicken stock",
          "2 tbsp Butter",
          "Spices: 3 Bay leaves, 1 tsp Thyme, 1 tsp Curry powder, 2 bouillon cubes",
          "Salt to taste"
        ],
        instructions: [
          "THE PREP: Wash the parboiled rice at least 4 times in warm water until the starch is gone and the water runs clear. Drain and set aside.",
          "THE BASE: Blend the tomatoes, bell peppers, scotch bonnets, and one onion into a smooth puree. Pour into a pot and boil on medium heat until the water evaporates and you're left with a thick paste.",
          "THE FRY: In a large, heavy-bottomed pot, heat the vegetable oil. Sauté the second onion (thinly sliced) until translucent. Add the tomato paste and fry for about 8 minutes. You MUST stir constantly; the paste should lose its raw sourness and turn a darker shade of red.",
          "THE SAUCE: Pour in your boiled tomato/pepper puree. Fry together with the paste for another 10-12 minutes until the oil starts to separate and float on top. This is the foundation of the flavor.",
          "THE SEASONING: Add the chicken stock, bay leaves, thyme, curry, and bouillon cubes. Bring to a rolling boil. Taste the liquid—it should be slightly over-seasoned, as the rice will absorb the flavor.",
          "THE STEAM: Add the washed rice. The liquid should be just level with the rice (add a splash of water if needed). Cover the pot with a tight sheet of aluminum foil, then put the lid on. This creates a pressure cooker environment.",
          "THE COOK: Reduce heat to the LOWEST possible setting. Cook for 35 minutes. DO NOT stir or open the lid during this time.",
          "THE FINISH: Open and check if the rice is tender. Add the butter and thin onion rings on top. Increase the heat to medium for 2-3 minutes—you should hear a slight crackling sound. This creates the 'bottom-pot' smokiness. Turn off heat and let it rest, covered, for 10 minutes before fluffing with a fork."
        ],
        tip: "The secret is the foil. Jollof rice is cooked by steam, not by boiling in water. If you add too much water, it will become soggy."
      },
      "Party Jollof Rice": {
        prepTime: "25 min",
        cookTime: "50 min",
        ingredients: [
          "3 cups Long grain parboiled rice",
          "5 large Roma tomatoes",
          "2 Red bell peppers (Tatashe)",
          "3 Scotch bonnet peppers (Atarodo)",
          "2 large Red onions",
          "1/2 cup Vegetable oil",
          "4 tbsp double concentrated Tomato paste",
          "3 cups rich Chicken stock",
          "2 tbsp Butter",
          "Spices: 3 Bay leaves, 1 tsp Thyme, 1 tsp Curry powder, 2 bouillon cubes",
          "Salt to taste"
        ],
        instructions: [
          "THE PREP: Wash the parboiled rice at least 4 times in warm water until the starch is gone and the water runs clear. Drain and set aside.",
          "THE BASE: Blend the tomatoes, bell peppers, scotch bonnets, and one onion into a smooth puree. Pour into a pot and boil on medium heat until the water evaporates and you're left with a thick paste.",
          "THE FRY: In a large, heavy-bottomed pot, heat the vegetable oil. Sauté the second onion (thinly sliced) until translucent. Add the tomato paste and fry for about 8 minutes. You MUST stir constantly; the paste should lose its raw sourness and turn a darker shade of red.",
          "THE SAUCE: Pour in your boiled tomato/pepper puree. Fry together with the paste for another 10-12 minutes until the oil starts to separate and float on top. This is the foundation of the flavor.",
          "THE SEASONING: Add the chicken stock, bay leaves, thyme, curry, and bouillon cubes. Bring to a rolling boil. Taste the liquid—it should be slightly over-seasoned, as the rice will absorb the flavor.",
          "THE STEAM: Add the washed rice. The liquid should be just level with the rice (add a splash of water if needed). Cover the pot with a tight sheet of aluminum foil, then put the lid on. This creates a pressure cooker environment.",
          "THE COOK: Reduce heat to the LOWEST possible setting. Cook for 35 minutes. DO NOT stir or open the lid during this time.",
          "THE FINISH: Open and check if the rice is tender. Add the butter and thin onion rings on top. Increase the heat to medium for 2-3 minutes—you should hear a slight crackling sound. This creates the 'bottom-pot' smokiness. Turn off heat and let it rest, covered, for 10 minutes before fluffing with a fork."
        ],
        tip: "The secret is the foil. Jollof rice is cooked by steam, not by boiling in water. If you add too much water, it will become soggy."
      },
      "Egusi & Pounded Yam": {
        prepTime: "30 min",
        cookTime: "45 min",
        ingredients: [
          "2 cups Ground Egusi (Melon seeds)",
          "1/2 cup Red Palm Oil",
          "1kg Assorted Meat (Beef, Shaki, Ponmo)",
          "1 large Smoked Fish (cleaned)",
          "2 tbsp Ground Crayfish",
          "2 cups chopped Fresh Spinach or Ugu",
          "1 tbsp Iru (Fermented locust beans)",
          "3 Habanero peppers (blended)",
          "Yam for pounding"
        ],
        instructions: [
          "MEAT PREP: Clean and boil your assorted meats with onions and seasoning until tender. Reserve at least 2 cups of the meat stock. De-bone your smoked fish and set aside.",
          "THE SWALLOW: Peel the yam, cut into rounds, and boil in unsalted water. It must be very soft. Keep the yam in the hot water until the moment you are ready to pound it to ensure a smooth, stretchy texture.",
          "THE EGUSI PASTE: Place ground egusi in a bowl. Add a tiny bit of water and mix into a very thick, lumpy paste. This ensures you get those beautiful 'curd' lumps in the soup.",
          "THE FRY: Heat palm oil in a deep pot for 2 minutes (do not bleach it). Add the blended peppers and iru. Fry for 5 minutes.",
          "THE LUMPS: Scoop the egusi paste into the oil in small balls using a spoon. Cover the pot and do NOT stir. Let it fry for 10 minutes on low heat. The egusi should set and become firm.",
          "THE SIMMER: Gently pour in the meat stock and the meat/fish. Stir very carefully to avoid breaking all the egusi lumps. Add the crayfish. Cover and simmer for 15 minutes. The oil should start to rise to the top.",
          "THE GREENS: Add the chopped spinach or ugu. Stir through and switch off the heat immediately. The residual heat will cook the vegetables without destroying their nutrients.",
          "THE POUNDING: Remove the hot yam from water. Pound in a mortar or use a heavy-duty food processor with a dough blade until it is completely smooth, white, and stretchy."
        ],
        tip: "Never boil the egusi before frying—frying the paste in palm oil is what creates the perfect texture."
      },
      "Fisherman Soup": {
        prepTime: "20 min",
        cookTime: "25 min",
        ingredients: [
          "1 large Fresh Catfish (cleaned and cut)",
          "500g Fresh Prawns or Shrimps",
          "1 cup Periwinkles (cleaned)",
          "1/2 cup Palm oil",
          "2 tbsp Ground Crayfish",
          "Fresh Cocoyam (used for thickening)",
          "Scent leaves and Uziza leaves",
          "Yellow Camerun Pepper"
        ],
        instructions: [
          "THE THICKENER: Boil 2-3 small cocoyams until soft. Peel and pound into a smooth paste. This will give the soup its signature silky texture.",
          "THE BASE: In a wide pot, add 3 cups of water, the Camerun pepper, and crayfish. Bring to a boil.",
          "THE FISH: Gently place the catfish pieces into the boiling water. Add the palm oil and periwinkles. Simmer for 10 minutes. Catfish is delicate; do not over-stir or it will break apart.",
          "THE SEAFOOD: Add the prawns and the cocoyam paste in small lumps. The paste will gradually melt into the soup, thickening it.",
          "THE AROMA: Once the soup has reached your desired thickness, add the chopped scent leaves and uziza. These provide the essential 'riverine' aroma.",
          "THE FINISH: Cook for another 3 minutes until the prawns are pink and firm. Serve hot with Pounded yam."
        ],
        tip: "Never use a spoon to stir Fisherman soup. Instead, gently shake or 'swirl' the pot by the handles to keep the fresh fish intact."
      },
      "Spicy Beef Suya": {
        prepTime: "15 min + 2hr Marinating",
        cookTime: "15 min",
        ingredients: [
          "500g Beef (Sirloin or Flank, sliced paper thin)",
          "1 cup Yaji Spice (Suya Pepper)",
          "1/4 cup Vegetable oil",
          "Wooden skewers (soaked in water)",
          "Red onions and Cabbage for serving"
        ],
        instructions: [
          "THE CUT: The secret to Suya is the thickness. Slice the beef against the grain into very thin, wide strips. Pro tip: freeze the meat for 30 mins before slicing to get it paper-thin.",
          "THE COAT: Layer the Yaji spice on a flat tray. Press each strip of meat into the spice until fully encrusted on both sides.",
          "THE SKEWER: Thread the meat onto the soaked skewers in a zig-zag (ribbon) pattern. Do not bunch it too tightly.",
          "THE MARINADE: Brush the skewered meat with vegetable oil and let it sit in the fridge for at least 2 hours. This allows the ginger and peanut oils in the Yaji to penetrate the fibers.",
          "THE GRILL: Use a very hot grill or a cast-iron griddle. Grill for 5-7 minutes per side. You want the edges to be slightly charred (suya must have that 'burnt' street flavor) but the center still moist.",
          "THE SERVE: Remove from heat, sprinkle with more fresh Yaji, and serve with plenty of raw sliced onions, tomatoes, and cabbage to cut through the heat."
        ],
        tip: "If you don't have a grill, use a very hot cast-iron griddle for that authentic street-food sear."
      },
      "Okra Soup (Draw)": {
        prepTime: "15 min",
        cookTime: "20 min",
        ingredients: [
          "300g Fresh Okra (finely chopped or grated)",
          "1/4 cup Palm oil",
          "Smoked Fish and Stock Fish",
          "Cooked Assorted Meat",
          "1 bulb Onion (chopped)",
          "Fresh Pepper (Atarodo) - blended",
          "Ground Crayfish and Iru",
          "Handful of Ugu or Spinach leaves"
        ],
        instructions: [
          "PREP THE DRAW: The smaller you chop or grate the okra, the more 'draw' (viscosity) you get. For maximum draw, use a traditional grater.",
          "THE BASE: Heat palm oil in a pot and sauté the onions and blended peppers for 3 mins. Add the meat, fish, and crayfish with a small amount of stock.",
          "THE BOIL: Let the stock boil and infuse with the fish and iru for 10 minutes.",
          "THE OKRA: Add the grated okra. Do NOT cover the pot from this point onwards—covering the pot causes okra to lose its viscosity (the draw).",
          "THE QUICK FINISH: Stir well and cook for 3-5 minutes. Add the green leaves, stir once more, and switch off the heat. Overcooking okra makes it lose its crunch and color."
        ],
        tip: "To increase the 'draw' even more, add a tiny pinch of edible potash or baking soda, but natural grating usually does the trick!"
      },
      "Amala & Ewedu": {
        prepTime: "20 min",
        cookTime: "30 min",
        ingredients: [
          "Amala (Yam flour)",
          "Fresh Jute leaves (Ewedu)",
          "Iru (Locust beans)",
          "Ground Crayfish",
          "Gbegiri (optional - peeled brown beans)",
          "Stew (Buka Stew or Palm oil based)"
        ],
        instructions: [
          "THE EWEDU: Pick the jute leaves and wash thoroughly. Pot-boil them in a small amount of water with locust beans and a bit of potash until soft.",
          "THE BLEND: Use a traditional 'ijabe' (small broom) or a blender to pulse the cooked leaves into a smooth, slimy consistency. Add crayfish and salt. Do not over-cook.",
          "THE AMALA: Bring a pot of water to a rolling boil. Reduce heat and slowly sprinkle the yam flour into the water, whisking vigorously with a wooden spoon (omorogun) to avoid lumps.",
          "THE STRETCH: Once it forms a thick paste, add a splash of hot water, cover, and let it steam for 5 minutes on very low heat.",
          "THE FINAL POUND: Use the spoon to turn and stretch the Amala until it's dark, smooth, and very stretchy. Serve with the Ewedu and a side of spicy Gbegiri soup."
        ],
        tip: "Authentic Amala should never have lumps. If your first batch is lumpy, sieve the flour next time before adding to the water."
      },
      "Nkwobi": {
        prepTime: "20 min",
        cookTime: "45 min",
        ingredients: [
          "1kg Cow leg chunks",
          "1 cup Palm oil",
          "Potash water",
          "Ground Crayfish",
          "Ugba (oil bean)",
          "Pepper and seasonings",
          "Utazi leaves and Red onions for garnish"
        ],
        instructions: [
          "Cook the cow leg chunks until very tender. Drain the stock.",
          "In a bowl, mix palm oil with potash water until it turns thick and yellowish.",
          "Add crayfish, pepper, and seasoning to the oil mix.",
          "Fold in the cooked meat and ugba. Stir well until coated.",
          "Warm gently on low heat for 5 minutes. Serve with utazi and raw onions."
        ],
        tip: "The potash is key for the thick yellow sauce."
      },
      "Tomato Basil Soup": {
        prepTime: "10 min",
        cookTime: "20 min",
        ingredients: ["6 ripe tomatoes", "2 cloves garlic", "1 small onion", "Fresh basil leaves", "Vegetable broth"],
        instructions: [
          "Sauté onions and garlic.",
          "Add tomatoes and broth, simmer for 15 mins.",
          "Add basil and blend until smooth."
        ],
        tip: "Slow roasting the tomatoes first adds layers of flavor."
      },
      "Classic Lasagna": {
        prepTime: "30 min",
        cookTime: "45 min",
        ingredients: ["Lasagna sheets", "Ground beef", "Marinara sauce", "Ricotta", "Mozzarella", "Parmesan"],
        instructions: [
          "Cook beef and mix with sauce.",
          "Layer sheets, sauce, and cheeses in a baking dish.",
          "Bake at 375F for 40 minutes until golden."
        ],
        tip: "Let it rest for 10 minutes before slicing to keep the layers intact."
      },
      "Moin Moin": {
        prepTime: "25 min",
        cookTime: "45 min",
        ingredients: ["Peeled beans", "Bell peppers", "Onions", "Crayfish", "Vegetable oil", "Hard boiled eggs"],
        instructions: [
          "Blend beans, peppers and onions into a smooth paste.",
          "Add oil, crayfish, and seasoning. Whisk well.",
          "Pour into containers, add egg slices, and steam for 45 minutes until firm."
        ],
        tip: "Incorporate air while whisking for a fluffy texture."
      },
      "Grown-up Grilled Cheese": {
        prepTime: "5 min",
        cookTime: "10 min",
        ingredients: ["Thick brioche bread", "Cheddar", "Gruyere", "Mozzarella", "Truffle oil", "Butter"],
        instructions: [
          "Butter the outside of the bread slices.",
          "Layer the cheeses and a few drops of truffle oil inside.",
          "Toast in a pan on medium-low heat until bread is golden and cheese is perfectly melted."
        ],
        tip: "Low and slow is the secret to a perfectly melted center without burning the bread."
      },
      "Salmon Teriyaki Box": {
        prepTime: "15 min",
        cookTime: "12 min",
        ingredients: ["Salmon fillet", "Soy sauce", "Mirin", "Sugar", "Ginger", "Rice", "Steamed veggies"],
        instructions: [
          "Mix soy sauce, mirin, sugar, and ginger to make teriyaki sauce.",
          "Sear the salmon in a pan.",
          "Pour sauce over salmon and let it glaze. Serve with rice and veggies."
        ],
        tip: "Don't overcook the salmon; it should be moist and flaky."
      },
      "Green Tea Soba": {
        prepTime: "5 min",
        cookTime: "5 min",
        ingredients: ["Cha Soba noodles", "Tsuyu dipping sauce", "Green onions", "Wasabi", "Nori"],
        instructions: [
          "Boil noodles for 5 minutes, then immediately chill in ice water.",
          "Serve with cold tsuyu sauce on the side.",
          "Garnish with sliced onions, nori, and a touch of wasabi."
        ],
        tip: "Rinsing well in cold water is essential for the bouncy texture of soba."
      },
      "Truffle Tagliatelle": {
        prepTime: "10 min",
        cookTime: "10 min",
        ingredients: ["Fresh Tagliatelle", "Heavy cream", "Parmesan", "Black truffle paste", "Garlic", "Butter"],
        instructions: [
          "Boil pasta until al dente.",
          "Make a sauce with butter, garlic, cream, and parmesan.",
          "Toss pasta into the sauce and stir in the truffle paste at the very end."
        ],
        tip: "Never boil the truffle paste; heat destroys its aromatic complexity."
      },
      "Chicken Suya": {
        prepTime: "20 min",
        cookTime: "15 min",
        ingredients: ["Chicken thighs (skinless)", "Yaji spice", "Vegetable oil", "Red onion", "Cucumber"],
        instructions: [
          "Slice chicken into thin strips and coat heavily with Yaji spice.",
          "Thread onto skewers and brush with oil.",
          "Grill until cooked through with a slight char."
        ],
        tip: "Chicken thighs stay much juicier than breasts for street-style Suya."
      },
      "Ram Suya": {
        prepTime: "20 min",
        cookTime: "15 min",
        ingredients: ["Ram meat (lean leg)", "Yaji spice", "Vegetable oil", "Onions"],
        instructions: [
          "Slice ram meat paper-thin across the grain.",
          "Encrust with yaji and grill on high heat.",
          "Serve piping hot with extra spice."
        ],
        tip: "Ram has a deeper, more gamey flavor that stands up well to heavy spice."
      },
      "Fried Rice & Turkey": {
        prepTime: "20 min",
        cookTime: "40 min",
        ingredients: ["Parboiled rice", "Turkey wings", "Carrots, peas, corn", "Liver", "Thyme, Curry", "Butter"],
        instructions: [
          "Season and fry/grill the turkey until golden.",
          "Cook rice with turkey stock and curry until dry.",
          "Sauté veggies and liver in butter, then toss with the rice."
        ],
        tip: "Stir-frying the rice with the veggies in small batches gives that perfect 'non-soggy' restaurant feel."
      },
      "Akara Sticks": {
        prepTime: "15 min",
        cookTime: "15 min",
        ingredients: ["Peeled beans", "Onion", "Pepper", "Vegetable oil"],
        instructions: [
          "Blend beans with very little water.",
          "Whisk until very fluffy.",
          "Scoop into hot oil and fry until golden brown balls form. Skewer them for serving."
        ],
        tip: "The fluffier the paste, the lighter the Akara."
      },
      "Zobo Drink": {
        prepTime: "5 min",
        cookTime: "20 min",
        ingredients: ["Dried Hibiscus leaves", "Ginger", "Pineapple bark", "Cloves", "Sugar or Honey"],
        instructions: [
          "Wash leaves and boil with ginger and pineapple bark for 20 mins.",
          "Strain and let it cool.",
          "Sweeten and serve chilled."
        ],
        tip: "The pineapple bark gives it a deeper, more complex sweetness."
      },
      "Warm Miso Soup": {
        prepTime: "5 min",
        cookTime: "10 min",
        ingredients: ["Water", "Dashi", "Miso paste", "Tofu", "Green onions", "Wakame"],
        instructions: [
          "Simmer water and dashi.",
          "Add tofu and wakame.",
          "Whisk in miso paste on low heat. Do not boil once miso is added."
        ],
        tip: "Boiling miso destroy its nutritional value and delicate flavor."
      },
      "Beans & Plantain (Dodo)": {
        prepTime: "15 min",
        cookTime: "45 min",
        ingredients: ["Honey beans", "Ripe plantain", "Palm oil", "Onions", "Pepper mix", "Crayfish"],
        instructions: [
          "Boil beans with onions until very soft.",
          "Make a palm oil sauce with peppers and crayfish, stir into beans.",
          "Fry sliced plantains until golden brown."
        ],
        tip: "Honey beans have a natural sweetness that pairs perfectly with plantain."
      },
      "Assorted Meat Pepper Soup": {
        prepTime: "15 min",
        cookTime: "40 min",
        ingredients: ["Tripe, liver, kidney, beef", "Pepper soup spice mix", "Ginger and garlic", "Scent leaves"],
        instructions: [
          "Boil meats with aromatics until tender.",
          "Add pepper soup spices and fresh pepper.",
          "Simmer for 15 mins and finish with fresh scent leaves."
        ],
        tip: "A good pepper soup should be spicy enough to clear your palate."
      },
      "Catfish Pepper Soup": {
        prepTime: "15 min",
        cookTime: "15 min",
        ingredients: ["Fresh catfish", "Pepper soup spice", "Onion", "Scent leaves"],
        instructions: [
          "Clean fish with salt/lemon to remove slime.",
          "Boil spiced broth first, then add fish chunks.",
          "Simmer for 12 minutes. Swirl the pot, do not stir."
        ],
        tip: "Fresh catfish is very delicate, handle with care."
      }
    };

    try {
      // Normalize dish name to match our fallbacks
      const normalizedName = dishName.trim().toLowerCase();
      const fallbackKey = Object.keys(recipeFallbacks).find(k => k.toLowerCase() === normalizedName);

      if (fallbackKey) {
        return res.json(recipeFallbacks[fallbackKey]);
      }

      const prompt = `Provide a detailed recipe for "${dishName}". 
      Include prep time, cook time, ingredients, and instructions.
      Add a "Soul Tip" for the extra touch.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prepTime: { type: Type.STRING },
              cookTime: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              tip: { type: Type.STRING }
            },
            required: ["prepTime", "cookTime", "ingredients", "instructions", "tip"]
          }
        }
      });

      res.json(JSON.parse(result.text));
    } catch (error: any) {
      if (error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        console.warn("Gemini Quota hit, using fallbacks for recipe:", dishName);
      } else {
        console.error("Recipe Error:", error);
      }
      
      // Return fallback if available, or a generic placeholder
      const normalizedName = dishName.trim().toLowerCase();
      const fallbackKey = Object.keys(recipeFallbacks).find(k => k.toLowerCase() === normalizedName);
      
      const fallback = (fallbackKey ? recipeFallbacks[fallbackKey] : null) || {
        prepTime: "15 min",
        cookTime: "30 min",
        ingredients: ["Main item", "Spices", "Love", "Water"],
        instructions: ["Prepare the ingredients with care.", "Cook slowly over medium heat.", "Season to taste.", "Enjoy in a quiet space."],
        tip: "Nourishment comes from the intention you put into the cooking."
      };
      res.json(fallback);
    }
  });

  // Mock Restaurants Endpoint
  app.get("/api/restaurants", (req, res) => {
    const restaurants = [
      {
        id: "r1",
        name: "The Comfy Spoon",
        type: "Warm Comfort",
        rating: 4.8,
        deliveryTime: "25-35 min",
        image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m1", name: "Tomato Basil Soup", price: 12, description: "Classic heartwarming soup with a side of sourdough." },
          { id: "m2", name: "Grown-up Grilled Cheese", price: 14, description: "Three cheeses with truffle oil on thick brioche." }
        ]
      },
      {
        id: "r2",
        name: "Zen Bento",
        type: "Japanese / Balanced",
        rating: 4.9,
        deliveryTime: "30-40 min",
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m3", name: "Salmon Teriyaki Box", price: 18, description: "Perfectly balanced with miso soup and salad." },
          { id: "m4", name: "Green Tea Soba", price: 15, description: "Cool and refreshing noodles for a calm mind." }
        ]
      },
      {
        id: "r3",
        name: "Mamma's Pasta",
        type: "Italian Soul",
        rating: 4.7,
        deliveryTime: "40-50 min",
        image: "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m5", name: "Truffle Tagliatelle", price: 21, description: "Rich, creamy, and deeply satisfying." },
          { id: "m6", name: "Classic Lasagna", price: 19, description: "Layers of love and slow-cooked ragu." }
        ]
      },
      {
        id: "r4",
        name: "Lagos Kitchen",
        type: "Naija Soul / Spicy",
        rating: 4.9,
        deliveryTime: "20-30 min",
        image: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m7", name: "Smoky Jollof Rice", price: 15, description: "Classic firewood taste served with fried plantain and chicken." },
          { id: "m8", name: "Egusi & Pounded Yam", price: 18, description: "Rich melon seed soup with choice of protein and fluffy yam." },
          { id: "m9", name: "Spicy Beef Suya", price: 12, description: "Thinly sliced beef with peanut-spice rub and onions." },
          { id: "m10", name: "Fisherman Soup", price: 22, description: "Loaded with fresh seafood, okra, and native spices." }
        ]
      },
      {
        id: "r5",
        name: "Naija Delights",
        type: "Authentic Nigerian",
        rating: 4.8,
        deliveryTime: "30-45 min",
        image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m11", name: "Fried Rice & Turkey", price: 17, description: "Savory fried rice with seasonal veggies and grilled turkey." },
          { id: "m12", name: "Okra Soup (Draw)", price: 16, description: "Smooth okra soup with assorted meat and fish." },
          { id: "m13", name: "Assorted Meat Pepper Soup", price: 14, description: "Clear, spicy broth with liver, kidney, and tripe." },
          { id: "m14", name: "Beans & Plantain (Dodo)", price: 10, description: "Honey beans slow-cooked with palm oil and sweet dodo." },
          { id: "m15", name: "Amala & Ewedu", price: 15, description: "Traditional Yoruba swallow with jute leaf soup and gbegiri." }
        ]
      },
      {
        id: "r6",
        name: "The Suya Spot",
        type: "Grilled / Street Food",
        rating: 4.7,
        deliveryTime: "15-25 min",
        image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800",
        menu: [
          { id: "m16", name: "Chicken Suya", price: 13, description: "Grilled chicken thighs in yaji spice." },
          { id: "m17", name: "Ram Suya", price: 16, description: "Premium ram meat grilled to perfection with spicy rub." },
          { id: "m18", name: "Kilishi (Beef Jerky)", price: 8, description: "Sun-dried, spiced beef wafers." },
          { id: "m19", name: "Akara Sticks", price: 6, description: "Fried bean cakes served with a spicy dip." },
          { id: "m20", name: "Zobo Drink", price: 4, description: "Refreshing hibiscus flower chilled drink." }
        ]
      }
    ];
    res.json(restaurants);
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
