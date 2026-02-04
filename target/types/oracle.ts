/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/oracle.json`.
 */
export type Oracle = {
  "address": "AL9bxB2BUHnPptqzospgwyeet8RwBbd4NmYmxuiNNzXd",
  "metadata": {
    "name": "oracle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "ORACLE Alpha - On-chain signal verification"
  },
  "instructions": [
    {
      "name": "closeSignal",
      "docs": [
        "Close a signal (mark as win/loss)"
      ],
      "discriminator": [
        115,
        224,
        27,
        34,
        218,
        194,
        251,
        135
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "signal",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "exitPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the Oracle with an authority"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "publishSignal",
      "docs": [
        "Publish a new signal on-chain"
      ],
      "discriminator": [
        169,
        80,
        49,
        93,
        169,
        216,
        95,
        190
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "signal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  105,
                  103,
                  110,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.total_signals",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "token",
          "type": "pubkey"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "score",
          "type": "u8"
        },
        {
          "name": "riskLevel",
          "type": "u8"
        },
        {
          "name": "sourcesBitmap",
          "type": "u8"
        },
        {
          "name": "mcap",
          "type": "u64"
        },
        {
          "name": "entryPrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "publishSignalWithProof",
      "docs": [
        "Publish a signal with reasoning proof commitment"
      ],
      "discriminator": [
        195,
        60,
        177,
        219,
        69,
        124,
        154,
        224
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "signal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  105,
                  103,
                  110,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "oracle_state.total_signals",
                "account": "oracleState"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "token",
          "type": "pubkey"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "score",
          "type": "u8"
        },
        {
          "name": "riskLevel",
          "type": "u8"
        },
        {
          "name": "sourcesBitmap",
          "type": "u8"
        },
        {
          "name": "mcap",
          "type": "u64"
        },
        {
          "name": "entryPrice",
          "type": "u64"
        },
        {
          "name": "reasoningHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "revealReasoning",
      "docs": [
        "Mark reasoning as revealed (after price movement)"
      ],
      "discriminator": [
        76,
        215,
        6,
        241,
        209,
        207,
        84,
        96
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "signal",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateAth",
      "docs": [
        "Update signal with ATH (for tracking)"
      ],
      "discriminator": [
        106,
        245,
        95,
        175,
        178,
        65,
        162,
        156
      ],
      "accounts": [
        {
          "name": "oracleState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
                  101,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "signal",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAth",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "oracleState",
      "discriminator": [
        97,
        156,
        157,
        189,
        194,
        73,
        8,
        15
      ]
    },
    {
      "name": "signal",
      "discriminator": [
        20,
        6,
        227,
        69,
        183,
        62,
        78,
        246
      ]
    }
  ],
  "events": [
    {
      "name": "reasoningRevealed",
      "discriminator": [
        136,
        27,
        89,
        205,
        193,
        65,
        142,
        210
      ]
    },
    {
      "name": "signalClosed",
      "discriminator": [
        129,
        164,
        126,
        13,
        84,
        53,
        21,
        41
      ]
    },
    {
      "name": "signalPublished",
      "discriminator": [
        27,
        49,
        10,
        82,
        168,
        186,
        203,
        42
      ]
    },
    {
      "name": "signalPublishedWithProof",
      "discriminator": [
        72,
        82,
        184,
        90,
        190,
        47,
        227,
        117
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "symbolTooLong",
      "msg": "Symbol too long (max 10 chars)"
    },
    {
      "code": 6002,
      "name": "invalidScore",
      "msg": "Invalid score (must be 0-100)"
    },
    {
      "code": 6003,
      "name": "signalAlreadyClosed",
      "msg": "Signal already closed"
    },
    {
      "code": 6004,
      "name": "reasoningAlreadyRevealed",
      "msg": "Reasoning already revealed"
    },
    {
      "code": 6005,
      "name": "noReasoningCommitment",
      "msg": "No reasoning commitment exists for this signal"
    }
  ],
  "types": [
    {
      "name": "oracleState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalSignals",
            "type": "u64"
          },
          {
            "name": "totalWins",
            "type": "u64"
          },
          {
            "name": "totalLosses",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "reasoningRevealed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "reasoningHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "signal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "riskLevel",
            "type": "u8"
          },
          {
            "name": "sourcesBitmap",
            "type": "u8"
          },
          {
            "name": "mcapAtSignal",
            "type": "u64"
          },
          {
            "name": "entryPrice",
            "type": "u64"
          },
          {
            "name": "athPrice",
            "type": "u64"
          },
          {
            "name": "exitPrice",
            "type": "u64"
          },
          {
            "name": "roiBps",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "signalStatus"
              }
            }
          },
          {
            "name": "reasoningHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reasoningRevealed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "signalClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "signalStatus"
              }
            }
          },
          {
            "name": "roiBps",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "signalPublished",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "signalPublishedWithProof",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "reasoningHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "signalStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "win"
          },
          {
            "name": "loss"
          },
          {
            "name": "closed"
          }
        ]
      }
    }
  ]
};
