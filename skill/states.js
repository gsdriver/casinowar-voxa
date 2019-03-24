'use strict';

/*
* States are the controller part of the Voxa's mvc model
* more info at http://voxa.readthedocs.io/en/latest/controllers.html
*/

const utils = require('./utils');
const seedrandom = require('seedrandom');

exports.register = function register(skill) {
  skill.onIntent('LaunchIntent', (alexaEvent) => {
    // Start a new game if we haven't before
    if (!alexaEvent.model.currentGame) {
      utils.initializeGame(alexaEvent, 'basic');
    }

    const game = alexaEvent.model[alexaEvent.model.currentGame];
    alexaEvent.model.userId = alexaEvent.user.userId;

    // To should be directed based on whether they are at war or not
    return { reply: (game.rounds) ? 'WelcomeBack' : 'Welcome', to: 'getBet' };
  });

  skill.onState('getBet', (alexaEvent) => {
    if ((alexaEvent.intent.name === 'BetIntent') || (alexaEvent.intent.name === 'AMAZON.YesIntent')) {
      let sideBetPlaced;
      const game = alexaEvent.model[alexaEvent.model.currentGame];
      let reply;
      let toState;

      // Place the bet and deal the cards
      const amount = utils.getBetAmount(alexaEvent);
      const sayBet = (game.bet !== amount);
      game.bet = amount;
      game.bankroll -= game.bet;

      // Now for the side bet - if we can afford it.  If not, don't bet on this round
      if (game.sideBet && (game.sideBet <= game.bankroll)) {
        game.bankroll -= game.sideBet;
        sideBetPlaced = true;
      }

      game.timestamp = Date.now();
      game.rounds = (game.rounds + 1) || 1;
      game.specialState = undefined;

      // If fewer than 20 cards, shuffle
      if (game.deck.length < 20) {
        utils.shuffleDeck(game, alexaEvent.user.userId);
      }
      game.player = [game.deck.shift()];
      game.dealer = [game.deck.shift()];
      if (process.env.FORCETIE) {
        game.dealer[0].rank = game.player[0].rank;
      }

      // Save dealt cards state
      alexaEvent.model.dealtCards = utils.sayDealtCards(alexaEvent, game.player[0],
          game.dealer[0], (sayBet) ? game.bet : undefined);

      // If these are the same rank - you have a war!
      if (game.player[0].rank == game.dealer[0].rank) {
        if (sideBetPlaced) {
          game.bankroll += 10 * game.sideBet;
          reply = 'HandResultWithWarAndSideBet';
        } else {
          reply = 'HandResultWithWar';
        }

        toState = 'atWar';
      } else {
        // OK, who won?
        if (game.player[0].rank > game.dealer[0].rank) {
          // You won!
          reply = 'HandResultWinner';
          game.bankroll += 2 * game.bet;
        } else {
          reply = 'HandResultLoser';
        }

        // Reset bankroll if necessary
        if ((game.bankroll < game.rules.minBet) && game.rules.canReset) {
          game.bankroll = game.startingBankroll;
          reply = 'HandResultReset';
        }

        toState = 'playAgain';
       }

      return { reply: reply, to: toState };
    } else if (alexaEvent.intent.name === 'AMAZON.NoIntent') {
      return { reply: 'Bye' };
    }
  });

  skill.onState('playWar', (alexaEvent) => {
    const res = require('./resources')(alexaEvent.request.locale);
    const game = alexaEvent.model[alexaEvent.model.currentGame];
    let toState;
    let reply;

    if (alexaEvent.intent.name === 'AMAZON.YesIntent') {
      if (game.bankroll < game.bet) {
        reply = 'NotEnoughForWar';
      } else {
        if (!game.wars) {
          game.wars = {};
        }
        game.wars.hit = (game.wars.hit + 1) || 1;

        // First burn three
        game.deck.shift();
        game.deck.shift();
        game.deck.shift();

        game.bankroll -= game.bet;
        game.player.push(game.deck.shift());
        game.dealer.push(game.deck.shift());

        alexaEvent.model.dealtCards = utils.sayDealtCards(alexaEvent, game.player[1], game.dealer[1]);

        // OK, who won (player wins ties)
        if (game.player[1].rank >= game.dealer[1].rank) {
          // You won!
          if ((game.player[1].rank == game.dealer[1].rank) &&
              game.rules.tieBonus) {
            reply = 'WarTieResult';
            game.bankroll += (3 + game.rules.tieBonus) * game.bet;
          } else {
            reply = 'HandResultWinner';
            game.bankroll += 3 * game.bet;
          }
        } else {
          reply = 'HandResultLoser';
        }

        toState = 'playAgain';
      }

      return {reply: reply, to: toState};
    } else if (alexaEvent.intent.name === 'AMAZON.NoIntent') {
      if (!game.wars) {
        game.wars = {};
      }
      game.wars.surrender = (game.wars.surrender + 1) || 1;

      // You lose half your bet
      game.bankroll += Math.floor(game.bet / 2);
      game.specialState = 'surrender';
      reply = 'WarSurrender';
      if ((game.bankroll < game.rules.minBet) && game.rules.canReset) {
        game.bankroll = game.startingBankroll;
        reply = 'WarReset';
      }

      return {reply: reply, to: 'playAgain'};
    }
  });

  skill.onState('atWar', () => {
    return {reply: 'AtWar', to: 'playWar'};
  });

  skill.onState('playAgain', () => {
    return {reply: 'PlayAgain', to: 'getBet'};
  });

  skill.onIntent('HighScoreIntent', async (alexaEvent) => {
    const reply = await utils.readLeaderBoard(alexaEvent);
    return { reply };
  });

  skill.onIntent('AMAZON.CancelIntent', () => {
    return { reply: 'Bye' };
  });

  skill.onIntent('AMAZON.StopIntent', () => {
    return { reply: 'Bye' };
  });
};
