//
// Utility functions
//

'use strict';

const request = require('request');
const querystring = require('querystring');
const speechUtils = require('alexa-speech-utils')();
const seedrandom = require('seedrandom');

module.exports = {
  initializeGame: function(alexaEvent, game) {
    alexaEvent.model.currentGame = game;
    const newGame = {
      startingBankroll: 5000,
      bankroll: 5000,
      rules: {
        minBet: 5,              // Minimum bet
        maxBet: 1000,           // Maximum bet
        numberOfDecks: 6,       // Number of decks
        tieBonus: 1,            // Additional amount paid on tie after war
        canReset: true,         // Can the game be reset
      },
      player: [],
      dealer: [],
    };

    module.exports.shuffleDeck(newGame, alexaEvent.user.userId);
    alexaEvent.model[alexaEvent.model.currentGame] = newGame;
  },
  readLeaderBoard: async function(alexaEvent) {
    const game = alexaEvent.model[alexaEvent.model.currentGame];
    const res = require('./resources')(alexaEvent.request.locale);
    let leaderURL = process.env.SERVICEURL + 'war/leaders';
    let status;
    const params = {};

    params.userId = alexaEvent.user.userId;
    params.score = game.bankroll;
    params.game = alexaEvent.model.currentGame;

    const paramText = querystring.stringify(params);
    if (paramText.length) {
      leaderURL += '?' + paramText;
    }

    return new Promise((resolve, reject) => {
      request(
        {
          uri: leaderURL,
          method: 'GET',
          timeout: 1000,
        }, (err, response, body) => {
        if (err) {
          // No scores to read
          status = 'NoHighScores';
        } else {
          const leaders = JSON.parse(body);

          if (!leaders.count || !leaders.top) {
            // Something went wrong
            status = 'NoHighScores';
          } else {
            status = 'HighScores';
            alexaEvent.model.ranking = {};

            // Do they have a rank?
            if (leaders.rank) {
              status = 'HighScoresAndRank';
              alexaEvent.model.ranking.bankroll = game.bankroll;
              alexaEvent.model.ranking.rank = leaders.rank;
              alexaEvent.model.ranking.players = roundPlayers(alexaEvent, leaders.count);
            }

            // And what is the leader board?
            let topScores = leaders.top;
            topScores = topScores.map((x) => res.strings.LEADER_BANKROLL_FORMAT.replace('{0}', x));
            alexaEvent.model.ranking.number = topScores.length;
            alexaEvent.model.ranking.leaders = speechUtils.and(topScores, {locale: alexaEvent.request.locale, pause: '300ms'});
          }
        }

        resolve(status);
      });
    });
  },
  shuffleDeck: function(game, userId) {
    let i;
    let rank;
    const start = Date.now();

    game.deck = [];
    const suits = ['C', 'D', 'H', 'S'];
    for (i = 0; i < game.rules.numberOfDecks; i++) {
      for (rank = 2; rank <= 14; rank++) {
        suits.map((item) => {
          game.deck.push({'rank': rank, 'suit': item});
        });
      }
    }

    // Shuffle using the Fisher-Yates algorithm
    for (i = 0; i < game.deck.length - 1; i++) {
      const randomValue = seedrandom(i + userId + (game.timestamp ? game.timestamp : ''))();
      let j = Math.floor(randomValue * (game.deck.length - i));
      if (j == (game.deck.length - i)) {
        j--;
      }
      j += i;
      const tempCard = game.deck[i];
      game.deck[i] = game.deck[j];
      game.deck[j] = tempCard;
    }

    console.log('Shuffle took ' + (Date.now() - start) + ' ms');
  },
  sayCard: function(alexaEvent, card) {
    const res = require('./resources')(alexaEvent.request.locale);
    const suits = JSON.parse(res.strings.CARD_SUITS);
    const ranks = res.strings.CARD_RANKS.split('|');

    return res.strings.CARD_NAME
      .replace('{0}', ranks[card.rank - 1])
      .replace('{1}', suits[card.suit]);
  },
  readHand: function(event, attributes, readBankroll) {
    const res = require('./resources')(event.request.locale);
    let speech = '';
    let reprompt = '';
    const game = attributes[attributes.currentGame];

    if (readBankroll) {
      speech += res.strings.READ_BANKROLL.replace('{0}', game.bankroll);
    }
    if (module.exports.atWar(attributes)) {
      // Repeat what they have
      speech += res.strings.READ_CARDS
        .replace('{0}', module.exports.sayCard(event, game.player[0]))
        .replace('{1}', module.exports.sayCard(event, game.dealer[0]));
      reprompt = res.strings.BET_REPROMPT_WAR;
    } else if (game.player.length) {
      // Repeat what they had
      speech += res.strings.READ_OLD_CARDS
        .replace('{0}', module.exports.sayCard(event, game.player[game.player.length - 1]))
        .replace('{1}', module.exports.sayCard(event, game.dealer[game.dealer.length - 1]));
      reprompt = res.strings.BET_PLAY_AGAIN;
    }

    return {speech: speech, reprompt: reprompt};
  },
  sayDealtCards: function(alexaEvent, playerCard, dealerCard, bet) {
    const res = require('./resources')(alexaEvent.request.locale);
    const format = (bet ? res.strings.BET_CARDS_SAYBET : res.strings.BET_CARDS);
    let playerText;
    let dealerText;

    if (playerCard.rank > 10) {
      playerText = module.exports.pickRandomOption(alexaEvent, 'GOOD_PLAYER_CARD');
    } else if (playerCard.rank < 5) {
      playerText = module.exports.pickRandomOption(alexaEvent, 'BAD_PLAYER_CARD');
    } else {
      playerText = module.exports.pickRandomOption(alexaEvent, 'NORMAL_PLAYER_CARD');
    }

    if ((dealerCard.rank > playerCard.rank) && (playerCard.rank > 10)) {
      dealerText = module.exports.pickRandomOption(alexaEvent, 'DEALER_TOUGH_BEAT');
    } else {
      dealerText = module.exports.pickRandomOption(alexaEvent, 'DEALER_CARD');
    }

    return format
        .replace('{0}', playerText.replace('{0}', module.exports.sayCard(alexaEvent, playerCard)))
        .replace('{1}', dealerText.replace('{0}', module.exports.sayCard(alexaEvent, dealerCard)))
        .replace('{2}', bet);
  },
  getBetAmount: function(alexaEvent) {
    let amount;
    const game = alexaEvent.model[alexaEvent.model.currentGame];

    if (alexaEvent.intent && alexaEvent.intent.params && alexaEvent.intent.params.Amount) {
      amount = parseInt(alexaEvent.intent.params.Amount);
    } else if (game.bet) {
      amount = game.bet;
    } else {
      amount = game.minBet;
    }

    // If we didn't get the amount, just make it a minimum bet
    if (isNaN(amount) || (amount == 0)) {
      amount = game.rules.minBet;
    }

    if (amount > game.rules.maxBet) {
      amount = game.rules.maxBet;
    } else if (amount < game.rules.minBet) {
      amount = game.rules.minBet;
    } else if (amount > game.bankroll) {
      amount = game.bankroll;
    }

    return amount;
  },
  pickRandomOption: function(alexaEvent, value) {
    const game = alexaEvent.model[alexaEvent.model.currentGame];
    const res = require('./resources')(alexaEvent.request.locale);

    if (res && res.strings[value]) {
      const options = res.strings[value].split('|');
      const randomValue = seedrandom(alexaEvent.user.userId + (game.timestamp ? game.timestamp : ''))();
      const choice = Math.floor(randomValue * options.length);
      if (choice == options.length) {
        choice--;
      }

      return options[choice];
    } else {
      return undefined;
    }
  },
  atWar: function(attributes) {
    const game = attributes[attributes.currentGame];
    return ((game.player.length == 1) && (game.dealer.length == 1)
      && (game.player[0].rank == game.dealer[0].rank)
      && (game.specialState !== 'surrender'));
  },
  drawTable: function(handlerInput, callback) {
    const response = handlerInput.responseBuilder;
    const event = handlerInput.requestEnvelope;
    const attributes = handlerInput.attributesManager.getSessionAttributes();

    if (event.context && event.context.System &&
      event.context.System.device &&
      event.context.System.device.supportedInterfaces &&
      event.context.System.device.supportedInterfaces.Display) {
      attributes.display = true;
      const start = Date.now();
      const game = attributes[attributes.currentGame];
      let nextCards;

      if ((game.player.length !== 1) || (game.player[0].rank !== game.dealer[0].rank)) {
        nextCards = game.deck.slice(0, 2);
      } else {
        // We're going to burn three if there is a war (assume so)
        nextCards = game.deck.slice(3, 5);
      }

      const formData = {
        dealer: JSON.stringify(game.dealer),
        player: JSON.stringify(game.player),
        nextCards: JSON.stringify(nextCards),
      };

      const params = {
        url: process.env.SERVICEURL + 'war/drawImage',
        formData: formData,
        timeout: 3000,
      };

      request.post(params, (err, res, body) => {
        if (err) {
          console.log(err);
          callback(err);
        } else {
          const imageUrl = JSON.parse(body).file;
          const end = Date.now();
          console.log('Drawing table took ' + (end - start) + ' ms');

          response.addRenderTemplateDirective({
            type: 'BodyTemplate6',
            backButton: 'HIDDEN',
            backgroundImage: {sources: [{url: imageUrl, widthPixels: 0, heightPixels: 0}]},
            title: '',
          });

          callback();
        }
      });
    } else {
      // Not a display device
      callback();
    }
  },
};

function roundPlayers(alexaEvent, playerCount) {
  const res = require('./resources')(alexaEvent.request.locale);
  if (playerCount < 200) {
    return playerCount;
  } else {
    // "Over" to the nearest hundred
    return res.strings.MORE_THAN_PLAYERS.replace('{0}', 100 * Math.floor(playerCount / 100));
  }
}
