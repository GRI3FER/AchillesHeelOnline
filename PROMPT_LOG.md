I started with Github Copilot but I quickly ran out of credits so I mostly used Claude and ChatGPT.

I mostly created the framework and first iteration of the game code by changing it from Brython to JS and then having AI help me debug the parts that didn't work and help me setup the online settings and improve the UI.

Here are my prompts (reordered logically):

1. (I pasted my Brython code).
	How would I make this code in JS and can you help me rewrite it

2. Setup a backend and game logic so I can play this game online.

3. Fix the room code so that when a new person joins they're on the right team

4. Make it so on the online you autogenerate the link to share as well for opponents and not just generate a code

5. Also make it so when you copy the link it takes you to the game and that you don't go to the homepage again

6. (I pasted a ton of error messages from Render or Vercel) Help me fix this :sob:

7. What does "Error: Command 'npm run build' exited with 126" mean?

8. Do not reveal the enemy's Achilles as it only reveals the type, so if you discern enemy Achilles type either highlight both pieces of that type or neither and remove that feature

9. Make sure to have it so the game ends even if the Achilles dies to the other Achilles during its immortality state

10. Make it so you choose new Achilles type by clicking on that piece so that it doesn't randomly

11. Choose which one it is and also don't just change the previous Achilles' type; instead, change the pawn to the previous Achilles type and then just make the piece that is selected the new Achilles

12. Make the moves log to the right side (chess.com setup)
